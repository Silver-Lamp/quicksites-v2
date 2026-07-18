// lib/partners/audioProvisioning/provisionClient.ts
//
// Calls HiveJournal's owner-scoped audio endpoints on a site owner's behalf, using the
// three-header grant model (contract: partner-provisioning.md §"The model"):
//   X-Partner-Id / X-Partner-Key / X-Partner-Grant.
// Server-only. Fails closed: if the flag is off, the secret is unset, or no active grant
// exists for the embed, it returns a typed error and never hits the network.
//
// The endpoint is LIVE-pending (HJ #1332) — this is the ready-to-flip consumer. The
// request/response shapes (welcome/testimonial) are ratified; the `usage` envelope is
// PROPOSED and read defensively.

import { hjBackendUrl, partnerSecret, partnerAudioEnabled, PARTNER_ID } from './config';
import { getGrantToken, getActiveGrant, touchGrant } from './grants';
import type {
  ProvisionError,
  ProvisionErrorCode,
  WelcomeResult,
  TestimonialResult,
} from './types';

/** Map an HJ HTTP error to our typed code (contract §"Error contract"). */
function codeForStatus(status: number, body: unknown): ProvisionErrorCode {
  const msg = typeof (body as { error?: string })?.error === 'string' ? (body as { error?: string }).error! : '';
  if (status === 401) return /revoked|grant/i.test(msg) ? 'invalid_or_revoked_grant' : 'invalid_partner_key';
  if (status === 402) return 'partner_quota_exceeded';
  if (status === 403) return /embed/i.test(msg) ? 'grant_embed_mismatch' : 'grant_scope';
  if (status === 429) return 'quota_exceeded';
  if (status === 503) return 'audio_not_configured';
  return 'unknown';
}

async function callProvision(
  embedId: string,
  path: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true; body: Record<string, unknown> } | ProvisionError> {
  if (!partnerAudioEnabled()) return { ok: false, code: 'disabled' };

  const grant = await getActiveGrant(embedId);
  if (!grant) return { ok: false, code: 'no_grant' };
  const token = await getGrantToken(embedId);
  if (!token) return { ok: false, code: 'no_grant' };

  let res: Response;
  try {
    res = await fetch(`${hjBackendUrl()}/api/about-that/${encodeURIComponent(embedId)}/${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Partner-Id': PARTNER_ID,
        'X-Partner-Key': partnerSecret(),
        'X-Partner-Grant': token,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return { ok: false, code: 'unknown', message: String((e as Error)?.message || e) };
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    /* non-JSON */
  }

  if (!res.ok) {
    const retryAfter = Number(res.headers.get('retry-after')) || null;
    return {
      ok: false,
      code: codeForStatus(res.status, body),
      status: res.status,
      message: typeof body.error === 'string' ? body.error : undefined,
      retryAfter,
      quotaRemaining: typeof body.quota_remaining === 'number' ? body.quota_remaining : null,
    };
  }

  void touchGrant(embedId);
  return { ok: true, body };
}

/** One-shot owner-voice welcome greeting (fixed script). */
export async function generateWelcome(
  embedId: string,
  script: string,
): Promise<WelcomeResult | ProvisionError> {
  const r = await callProvision(embedId, 'welcome', { script });
  if (!r.ok) return r;
  const b = r.body;
  return {
    ok: true,
    welcome_id: String(b.welcome_id ?? ''),
    audio_url: String(b.audio_url ?? ''),
    cached: Boolean(b.cached),
    usage: (b.usage as WelcomeResult['usage']) ?? undefined,
  };
}

/** A single narrated testimonial (fixed quote). */
export async function generateTestimonial(
  embedId: string,
  quote: string,
): Promise<TestimonialResult | ProvisionError> {
  const r = await callProvision(embedId, 'testimonial', { quote });
  if (!r.ok) return r;
  const b = r.body;
  return {
    ok: true,
    testimonial_id: String(b.testimonial_id ?? ''),
    audio_url: String(b.audio_url ?? ''),
    cached: Boolean(b.cached),
    usage: (b.usage as TestimonialResult['usage']) ?? undefined,
  };
}
