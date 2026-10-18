// app/api/admin/creative/[project]/upload/route.ts
//
// POST JSON { path, track, title?, notes? } → register a take the browser has ALREADY put into
// the `videos` bucket through the signed URL from ../upload-url. Mints the next version number
// for the track and fills the transcript in after the response (Whisper via the meter; a
// failure is recorded as 'failed', the row still exists). Admin-only.
//
// ⚠️ No file bytes come through here: Vercel caps a function body at 4.5 MB and a generator WAV
// is ~6 MB — the first version of this route took multipart and 413'd on the third take
// (2026-10-18). The path is verified to exist in the bucket under this project's prefix before a
// row is written, so a typed path cannot register someone else's object.
import { NextResponse, after } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { reviewProject } from '@/lib/creative/projects';
import { addVersion, setTranscript } from '@/lib/creative/versions';
import { transcribeTakeUrl } from '@/lib/creative/transcribe';
import { takeKindFor } from '@/lib/creative/takeTypes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ project: string }> }) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const admin = gate as { id?: string };
  const { project: key } = await ctx.params;
  const project = reviewProject(key);
  if (!project) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const track = project.tracks.find((t) => t.key === String(body?.track ?? ''));
  if (!track) return NextResponse.json({ error: 'unknown_track' }, { status: 400 });
  const path = String(body?.path ?? '');
  const prefix = `${project.key}/takes/${track.key}-`;
  if (!path.startsWith(prefix) || path.includes('..')) return NextResponse.json({ error: 'bad_path' }, { status: 400 });
  const info = takeKindFor('', path);
  if (!info || info.kind !== track.kind) return NextResponse.json({ error: 'kind_mismatch' }, { status: 400 });

  // The object must actually be there — the browser's PUT may have failed after the URL was signed.
  const dir = path.slice(0, path.lastIndexOf('/'));
  const name = path.slice(path.lastIndexOf('/') + 1);
  const { data: listed, error: listErr } = await supabaseAdmin.storage.from('videos').list(dir, { search: name, limit: 5 });
  if (listErr) return NextResponse.json({ error: 'storage_unreadable', detail: listErr.message }, { status: 502 });
  const obj = (listed ?? []).find((o) => o.name === name);
  if (!obj) return NextResponse.json({ error: 'not_uploaded', hint: 'The file never landed in storage; try the upload again.' }, { status: 409 });

  const url = supabaseAdmin.storage.from('videos').getPublicUrl(path).data.publicUrl;
  const title = String(body?.title ?? '').trim() || track.label;
  const notes = String(body?.notes ?? '').trim() || null;
  const version = await addVersion({ project: project.key, track: track.key, kind: track.kind, title, url, contentType: info.contentType, notes, createdBy: admin.id ?? null, transcriptStatus: track.kind === 'audio' ? 'pending' : 'skipped' });

  if (track.kind === 'audio') {
    after(async () => {
      const t = await transcribeTakeUrl(url, { userId: admin.id ?? null });
      if (t.ok) await setTranscript(version.id, t.text, 'done', t.durationSec);
      else await setTranscript(version.id, null, 'failed');
    });
  }
  return NextResponse.json({ ok: true, version });
}
