// app/api/admin/creative/[project]/upload-url/route.ts
//
// POST { track, filename, contentType, size } → a one-shot signed upload URL into the public
// `videos` bucket. The browser PUTs the bytes THERE, never through our API.
//
// ⚠️ WHY. The first "Add take" posted the file as multipart to our route and Vercel answered 413:
// a serverless function body is capped at 4.5 MB, and every 30 s WAV the generator makes is ~6 MB
// — so the box I shipped failed on the one file it exists for (found on the third take,
// 2026-10-18). A signed URL moves the bytes browser → storage; our route sees only metadata.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { reviewProject } from '@/lib/creative/projects';
import { takeKindFor, MAX_TAKE_BYTES } from '@/lib/creative/takeTypes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ project: string }> }) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const { project: key } = await ctx.params;
  const project = reviewProject(key);
  if (!project) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const track = project.tracks.find((t) => t.key === String(body?.track ?? ''));
  if (!track) return NextResponse.json({ error: 'unknown_track' }, { status: 400 });
  const info = takeKindFor(String(body?.contentType ?? ''), String(body?.filename ?? ''));
  if (!info) return NextResponse.json({ error: 'unsupported_type', detail: body?.contentType }, { status: 415 });
  if (info.kind !== track.kind) return NextResponse.json({ error: 'kind_mismatch', detail: `${track.label} takes ${track.kind}` }, { status: 400 });
  const size = Number(body?.size ?? 0);
  if (!Number.isFinite(size) || size <= 0 || size > MAX_TAKE_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 });

  const path = `${project.key}/takes/${track.key}-${Date.now()}-${globalThis.crypto.randomUUID().slice(0, 8)}.${info.ext}`;
  const { data, error } = await supabaseAdmin.storage.from('videos').createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: 'sign_failed', detail: error?.message }, { status: 502 });
  return NextResponse.json({ ok: true, path, signedUrl: data.signedUrl, token: data.token, contentType: info.contentType });
}
