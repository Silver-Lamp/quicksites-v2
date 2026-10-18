// app/api/admin/creative/[project]/upload/route.ts
//
// POST multipart { file, track, title?, notes? } → the take lands in the public `videos` bucket
// under <project>/takes/, a `creative_versions` row is minted with the next version number for the
// track, and the transcript is filled in after the response (Whisper via the meter; a failure is
// recorded as 'failed', the row still exists). Admin-only. WAV/MP3/M4A/MP4/WebM, 60 MB cap — a
// 30 s WAV from the generator is ~6 MB; the browser plays WAV natively, so no re-encode here
// (ffmpeg lives only in scripts/, never on Vercel).
import { NextResponse, after } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { reviewProject } from '@/lib/creative/projects';
import { addVersion, setTranscript } from '@/lib/creative/versions';
import { transcribeTakeUrl } from '@/lib/creative/transcribe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 60 * 1024 * 1024;
const EXT: Record<string, { ext: string; kind: 'audio' | 'video' }> = {
  'audio/wav': { ext: 'wav', kind: 'audio' },
  'audio/x-wav': { ext: 'wav', kind: 'audio' },
  'audio/wave': { ext: 'wav', kind: 'audio' },
  'audio/mpeg': { ext: 'mp3', kind: 'audio' },
  'audio/mp4': { ext: 'm4a', kind: 'audio' },
  'audio/x-m4a': { ext: 'm4a', kind: 'audio' },
  'video/mp4': { ext: 'mp4', kind: 'video' },
  'video/webm': { ext: 'webm', kind: 'video' },
  'video/quicktime': { ext: 'mov', kind: 'video' },
};

export async function POST(req: Request, ctx: { params: Promise<{ project: string }> }) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const admin = gate as { id?: string };
  const { project: key } = await ctx.params;
  const project = reviewProject(key);
  if (!project) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file_required' }, { status: 400 });
  const trackKey = String(form?.get('track') ?? '').trim();
  const track = project.tracks.find((t) => t.key === trackKey);
  if (!track) return NextResponse.json({ error: 'unknown_track' }, { status: 400 });
  const typeInfo = EXT[file.type] ?? (file.name.toLowerCase().endsWith('.wav') ? EXT['audio/wav'] : null);
  if (!typeInfo) return NextResponse.json({ error: 'unsupported_type', detail: file.type }, { status: 415 });
  if (typeInfo.kind !== track.kind) return NextResponse.json({ error: 'kind_mismatch', detail: `${track.label} takes ${track.kind}` }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 });

  const path = `${project.key}/takes/${track.key}-${Date.now()}-${globalThis.crypto.randomUUID().slice(0, 8)}.${typeInfo.ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || (typeInfo.ext === 'wav' ? 'audio/wav' : 'application/octet-stream');
  const { error } = await supabaseAdmin.storage.from('videos').upload(path, bytes, { contentType, cacheControl: '86400', upsert: false });
  if (error) return NextResponse.json({ error: 'upload_failed', detail: error.message }, { status: 502 });
  const url = supabaseAdmin.storage.from('videos').getPublicUrl(path).data.publicUrl;

  const title = String(form?.get('title') ?? '').trim() || track.label;
  const notes = String(form?.get('notes') ?? '').trim() || null;
  const version = await addVersion({ project: project.key, track: track.key, kind: track.kind, title, url, contentType, notes, createdBy: admin.id ?? null, transcriptStatus: track.kind === 'audio' ? 'pending' : 'skipped' });

  if (track.kind === 'audio') {
    after(async () => {
      const t = await transcribeTakeUrl(url, { userId: admin.id ?? null });
      if (t.ok) await setTranscript(version.id, t.text, 'done', t.durationSec);
      else await setTranscript(version.id, null, 'failed');
    });
  }
  return NextResponse.json({ ok: true, version });
}
