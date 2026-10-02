// app/api/admin/demo-narration/tts/route.ts
//
// Synthesise narration for every scripted line in the owner's consented HiveJournal voice clone,
// stored alongside — never over — whatever he recorded himself.
//
// ⚠️ `voice_basis` DECIDES WHAT MAY BE SAID ABOUT THE RESULT. HJ reports which voice actually
// spoke: `self` (his own consented clone) or `narrator` (the house voice). We store exactly what
// was reported and nothing is labelled "in your voice" unless it says `self`. An unreported
// basis is stored as NULL and must read as unknown — never optimistically as self.
// (crosstalk/contracts/partner-provisioning.md §Consent v2.)
//
// ⚠️ THE AUDIO IS COPIED INTO OUR OWN PRIVATE BUCKET rather than referenced at HJ's URL. A
// remote URL can expire or move, and a narration take that silently 404s mid-mix produces a
// track with a hole in it that nobody notices until a visitor hears the gap.
//
// ⚠️ `welcome` is specified as a ONE-SHOT greeting with a fixed script, and we are calling it
// once per narration line. That is plausibly outside its intent and it bills per call, so this
// route caps the number of lines and HJ have been asked whether they are happy with the usage.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { parseClipKey, parseManifest } from '@/lib/demos/narration';
import { partnerAudioEnabled } from '@/lib/partners/audioProvisioning/config';
import { generateWelcome } from '@/lib/partners/audioProvisioning/provisionClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BUCKET = 'demo-narration';
/** A demo script is a handful of lines; a hundred would be a bug or a bill. */
const MAX_LINES = 20;

const Body = z.object({
  clipKey: z.string().min(3),
  manifestUrl: z.string().url(),
  embedId: z.string().min(4),
});

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  if (!partnerAudioEnabled()) {
    return NextResponse.json(
      { error: 'Partner audio provisioning is not configured in this environment.', code: 'not_configured' },
      { status: 503 },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body', issues: parsed.error.issues }, { status: 400 });
  }
  const { clipKey, manifestUrl, embedId } = parsed.data;
  if (!parseClipKey(clipKey)) {
    return NextResponse.json({ error: 'clipKey must be <clip>@<recordedOn>' }, { status: 400 });
  }

  const manifest = parseManifest(await fetch(manifestUrl, { cache: 'no-store' }).then((r) => r.json()).catch(() => null));
  if (!manifest) return NextResponse.json({ error: 'could not read the cue manifest' }, { status: 400 });
  if (manifest.lines.length > MAX_LINES) {
    return NextResponse.json({ error: `refusing: ${manifest.lines.length} lines exceeds the cap` }, { status: 400 });
  }

  const results: Array<{ lineIndex: number; ok: boolean; voiceBasis: string | null; error?: string }> = [];

  for (const line of manifest.lines) {
    try {
      const gen = await generateWelcome(embedId, line.say);
      if (!gen.ok) {
        // ⚠️ Surface HJ's documented code, not a generic failure. `voice_third_party` in
        // particular is the consent bright line — HJ refuses rather than quietly downgrading
        // to the house narrator, and an operator needs to see that word to understand why.
        results.push({ lineIndex: line.index, ok: false, voiceBasis: null, error: gen.code });
        // A revoked grant or an exhausted quota will fail identically on every remaining line.
        if (['no_grant', 'invalid_or_revoked_grant', 'grant_scope', 'grant_embed_mismatch',
             'invalid_partner_key', 'quota_exceeded', 'partner_quota_exceeded', 'disabled',
             'audio_not_configured'].includes(gen.code)) {
          break;
        }
        continue;
      }
      const audioUrl = gen.audio_url;

      // ⚠️ Whatever HJ reported, verbatim. Absent → null → "unknown", never 'self'.
      const basis = gen.usage?.voice_basis === 'self' || gen.usage?.voice_basis === 'narrator'
        ? gen.usage.voice_basis
        : null;

      const bytes = Buffer.from(await (await fetch(audioUrl)).arrayBuffer());
      const safeKey = clipKey.replace(/[^a-zA-Z0-9@._-]/g, '_');
      const storagePath = `${safeKey}/tts-line-${String(line.index).padStart(3, '0')}.mp3`;
      const { error: upErr } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(storagePath, bytes, { contentType: 'audio/mpeg', upsert: true });
      if (upErr) {
        results.push({ lineIndex: line.index, ok: false, voiceBasis: basis, error: upErr.message });
        continue;
      }

      // ⚠️ Duration is not reported, and a wrong one would mis-place every later cue in the
      // preview. 0 is not allowed by the schema, so estimate from bytes at a conservative
      // bitrate and let the browser correct it on load — the mix reads the real duration.
      const estimatedMs = Math.max(500, Math.round((bytes.length * 8) / 32_000 * 1000));

      const { error: dbErr } = await supabaseAdmin.from('demo_narration_takes').upsert(
        {
          clip_key: clipKey,
          line_index: line.index,
          source: 'tts',
          storage_path: storagePath,
          duration_ms: estimatedMs,
          said: line.say,
          voice_basis: basis,
          embed_id: embedId,
          created_by: gate.user?.id ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'clip_key,line_index,source' },
      );
      if (dbErr) {
        results.push({ lineIndex: line.index, ok: false, voiceBasis: basis, error: dbErr.message });
        continue;
      }
      results.push({ lineIndex: line.index, ok: true, voiceBasis: basis });
    } catch (e: any) {
      results.push({ lineIndex: line.index, ok: false, voiceBasis: null, error: e?.message ?? String(e) });
    }
  }

  const ok = results.filter((r) => r.ok);
  const bases = new Set(ok.map((r) => r.voiceBasis));
  return NextResponse.json({
    ok: true,
    generated: ok.length,
    failed: results.length - ok.length,
    // One basis for the whole set only when every line agrees; otherwise the UI must not claim one.
    voiceBasis: bases.size === 1 ? [...bases][0] : null,
    results,
  });
}
