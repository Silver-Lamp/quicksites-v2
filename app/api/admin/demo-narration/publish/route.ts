// app/api/admin/demo-narration/publish/route.ts
//
// Publish a finished narration mix so visitors can hear it on /features.
//
// ⚠️ THE TAKES THEMSELVES CAN NEVER BE SERVED PUBLICLY. They live in a private bucket behind
// short-lived signed URLs, because an individual take is an unreleased recording of a named
// person mid-sentence. What goes public is the deliberate MIX — one artifact the owner chose to
// publish, written to the same public `videos` bucket the clips use.
//
// ⚠️ The published path is dated like the clip it belongs to, so a re-record never silently
// inherits narration timed against the previous cut.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { parseClipKey } from '@/lib/demos/narration';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'videos';
/** A mono speech mix of a ~30s clip is ~1.5 MB; this is headroom, not a target. */
const MAX_BYTES = 25 * 1024 * 1024;

const Meta = z.object({
  clipKey: z.string().min(3),
  /** The clip this narrates, so we attach to the right row. */
  clipSrc: z.string().url(),
  durationMs: z.coerce.number().int().positive(),
  /** How many scripted lines actually have a take — surfaced, never hidden. */
  linesRecorded: z.coerce.number().int().min(0),
  linesTotal: z.coerce.number().int().min(1),
  /** Which version went live, and — for a synthesised one — whose voice HJ said it was. */
  source: z.enum(['recorded', 'tts']).default('recorded'),
  voiceBasis: z.enum(['self', 'narrator']).optional(),
});

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'expected multipart/form-data' }, { status: 400 });

  const parsed = Meta.safeParse({
    clipKey: form.get('clipKey'),
    clipSrc: form.get('clipSrc'),
    durationMs: form.get('durationMs'),
    linesRecorded: form.get('linesRecorded'),
    linesTotal: form.get('linesTotal'),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body', issues: parsed.error.issues }, { status: 400 });
  }
  const { clipKey, clipSrc, durationMs, linesRecorded, linesTotal, source, voiceBasis } = parsed.data;

  // ⚠️ REFUSE TO PUBLISH A VOICE WE CANNOT ACCOUNT FOR. A synthesised mix may go out as the
  // owner's voice only when HiveJournal reported `self`; `narrator` is the house voice and an
  // absent basis is unknown. Publishing either as his own is the exact mislabelling the
  // audio-honesty standard exists to prevent, and the admin UI warns — but a UI warning is not
  // an enforcement point, so the refusal lives here.
  if (source === 'tts' && voiceBasis !== 'self') {
    return NextResponse.json(
      {
        error:
          voiceBasis === 'narrator'
            ? 'That synthesis came back as the house narrator, not your voice. Publishing it on a product page would present it as yours.'
            : 'HiveJournal did not report which voice spoke, so this cannot be published as your voice.',
        code: 'voice_basis_not_self',
      },
      { status: 409 },
    );
  }
  const key = parseClipKey(clipKey);
  if (!key) return NextResponse.json({ error: 'clipKey must be <clip>@<recordedOn>' }, { status: 400 });

  const audio = form.get('audio');
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: 'audio is required' }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json({ error: 'mix is too large' }, { status: 413 });
  }

  // Server-derived path, dated to match the clip. Never anything the client names.
  const storagePath = `demos/${key.recordedOn}/${key.clip}-narration.wav`;
  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, Buffer.from(await audio.arrayBuffer()), {
      contentType: 'audio/wav',
      upsert: true,
    });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const url = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;

  // ⚠️ Read-modify-write the jsonb array rather than patching by index: the array's order is
  // not stable (planDemoClips sorts by date) and the same clip can be attached to more than one
  // feature. Match on src, update every row that carries it.
  const { data: rows, error: readErr } = await supabaseAdmin
    .from('features')
    .select('id, demo_clips')
    .not('demo_clips', 'is', null);
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

  let updated = 0;
  for (const row of (rows ?? []) as Array<{ id: string; demo_clips: unknown }>) {
    const clips = Array.isArray(row.demo_clips) ? (row.demo_clips as Array<Record<string, unknown>>) : [];
    if (!clips.some((c) => c?.src === clipSrc)) continue;
    const next = clips.map((c) =>
      c?.src === clipSrc
        ? {
            ...c,
            narration: url,
            narration_duration_ms: durationMs,
            // Stored so the page can say "3 of 6 lines" rather than implying a full reading.
            narration_lines_recorded: linesRecorded,
            narration_lines_total: linesTotal,
            narration_source: source,
            ...(voiceBasis ? { narration_voice_basis: voiceBasis } : {}),
          }
        : c,
    );
    const { error } = await supabaseAdmin.from('features').update({ demo_clips: next }).eq('id', row.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    updated += 1;
  }

  if (updated === 0) {
    // The file is uploaded but nothing references it — say so rather than reporting success.
    return NextResponse.json(
      { error: 'uploaded, but no feature carries that clip src — nothing was attached', url },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, url, featuresUpdated: updated, linesRecorded, linesTotal });
}
