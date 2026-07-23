// app/api/glasses/capture/route.ts
//
// SecondSet glasses capture ingest (docs/SECONDSET_GLASSES_PLAN.md). HJ's glasses app
// POSTs a tech's capture here against a QS-issued per-job capture token — the glasses
// never hold QS creds; the opaque, scoped, expiring token IS the credential. Flag-gated.
//
// Body (reconciled to HJ's contracts/glasses-capture.md when it lands):
//   { capture_token, photos?: string[], transcript?: string, audio_url?: string, captured_by?: string }
//
// Optional defense-in-depth: if SECONDSET_INGEST_SECRET is set, require it in the
// `X-Secondset-Key` header (only HJ can post, even with a leaked token).

import { NextResponse } from 'next/server';
import { SECONDSET_ENABLED } from '@/lib/flags/secondset';
import { getJobByCaptureToken, addCapture } from '@/lib/serviceJobs/serviceJobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!SECONDSET_ENABLED) return NextResponse.json({ error: 'not_enabled' }, { status: 404 });

  const secret = process.env.SECONDSET_INGEST_SECRET;
  if (secret && req.headers.get('x-secondset-key') !== secret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const captureToken = typeof body.capture_token === 'string' ? body.capture_token.trim() : '';
  if (!captureToken) return NextResponse.json({ error: 'missing_capture_token' }, { status: 400 });

  const job = await getJobByCaptureToken(captureToken);
  if (!job) return NextResponse.json({ error: 'invalid_or_expired_token' }, { status: 401 });

  const photos: string[] = Array.isArray(body.photos)
    ? body.photos.filter((p: any) => typeof p === 'string' && p.trim())
    : [];
  const transcript = typeof body.transcript === 'string' ? body.transcript.trim() : '';
  const audioUrl = typeof body.audio_url === 'string' ? body.audio_url.trim() : '';
  const capturedBy = typeof body.captured_by === 'string' ? body.captured_by.slice(0, 200) : null;

  if (!photos.length && !transcript && !audioUrl) {
    return NextResponse.json({ error: 'empty_capture' }, { status: 400 });
  }

  const created: string[] = [];
  try {
    for (const photo of photos) {
      const c = await addCapture(job.id, { kind: 'photo', photoUrl: photo, capturedBy });
      if (c) created.push(c.id);
    }
    if (transcript || audioUrl) {
      const c = await addCapture(job.id, {
        kind: 'note',
        transcript: transcript || null,
        audioUrl: audioUrl || null,
        capturedBy,
      });
      if (c) created.push(c.id);
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'capture_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, job_id: job.id, captures: created.length });
}
