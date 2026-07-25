// app/api/partner/audio/generate/route.ts
//
// Generate owner-voice audio for a site the caller owns, via HiveJournal on the owner's
// behalf (contract: partner-provisioning.md). The caller must own the active grant for
// the embed — we authorize against the stored grant's user_id, not the client's claim.
// The actual HJ call fails closed if the flag/secret/grant are missing.
//
// Owner-gated. Returns the audio_url (+ whether it was a cache hit / billed / which voice
// basis spoke) or a typed error mapped from HJ's error contract.
//
// `voiceBasis` is echoed straight from HJ's B1 envelope (consent v2) so the UI can label
// honestly — 'self' = the owner's own cloned voice, 'narrator' = the standard voice,
// undefined = unknown, which must read as neither. We never infer it.

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import { partnerAudioEnabled } from '@/lib/partners/audioProvisioning/config';
import { getActiveGrant } from '@/lib/partners/audioProvisioning/grants';
import { generateWelcome, generateTestimonial } from '@/lib/partners/audioProvisioning/provisionClient';
import type { ProvisionError, ProvisionErrorCode } from '@/lib/partners/audioProvisioning/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** HTTP status to surface for each typed provision error. */
const STATUS_FOR: Record<ProvisionErrorCode, number> = {
  disabled: 503,
  no_grant: 409,
  invalid_partner_key: 502,
  invalid_or_revoked_grant: 409,
  grant_scope: 403,
  grant_embed_mismatch: 403,
  voice_third_party: 403,
  quota_exceeded: 429,
  partner_quota_exceeded: 402,
  audio_not_configured: 503,
  unknown: 502,
};

function errorResponse(err: ProvisionError): Response {
  return NextResponse.json(
    { error: err.message || err.code, code: err.code, quotaRemaining: err.quotaRemaining ?? null },
    { status: STATUS_FOR[err.code] ?? 502 },
  );
}

export async function POST(req: Request): Promise<Response> {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  if (!partnerAudioEnabled()) {
    return NextResponse.json({ error: 'audio provisioning not enabled', code: 'disabled' }, { status: 503 });
  }

  let body: { hjEmbedId?: string; kind?: string; script?: string; quote?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const hjEmbedId = String(body.hjEmbedId ?? '').trim();
  const kind = String(body.kind ?? '').trim();
  if (!UUID_RX.test(hjEmbedId)) return NextResponse.json({ error: 'hjEmbedId must be a uuid' }, { status: 400 });

  // Authorize against the stored grant, not the client's word: the caller must own the
  // active grant for this embed.
  const grant = await getActiveGrant(hjEmbedId);
  if (!grant) return NextResponse.json({ error: 'no active connection for this embed', code: 'no_grant' }, { status: 409 });
  if (grant.userId !== gate.user.id) {
    return NextResponse.json({ error: 'forbidden', code: 'not_owner' }, { status: 403 });
  }

  if (kind === 'welcome') {
    const script = String(body.script ?? '').trim();
    if (!script) return NextResponse.json({ error: 'script required' }, { status: 400 });
    const r = await generateWelcome(hjEmbedId, script);
    if (!r.ok) return errorResponse(r);
    return NextResponse.json({
      ok: true,
      welcome_id: r.welcome_id,
      audio_url: r.audio_url,
      cached: r.cached,
      voiceBasis: r.usage?.voice_basis ?? null,
    });
  }

  if (kind === 'testimonial') {
    const quote = String(body.quote ?? '').trim();
    if (!quote) return NextResponse.json({ error: 'quote required' }, { status: 400 });
    const r = await generateTestimonial(hjEmbedId, quote);
    if (!r.ok) return errorResponse(r);
    return NextResponse.json({
      ok: true,
      testimonial_id: r.testimonial_id,
      audio_url: r.audio_url,
      cached: r.cached,
      voiceBasis: r.usage?.voice_basis ?? null,
    });
  }

  return NextResponse.json({ error: "kind must be 'welcome' or 'testimonial'" }, { status: 400 });
}
