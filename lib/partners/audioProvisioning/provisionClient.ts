// lib/partners/audioProvisioning/provisionClient.ts
//
// Calls HiveJournal's owner-scoped audio endpoints on a site owner's behalf, using the
// three-header grant model (contract: partner-provisioning.md §"The model"):
//   X-Partner-Id / X-Partner-Key / X-Partner-Grant.
// Server-only. Fails closed: if the flag is off, the secret is unset, or no active grant
// exists for the embed, it returns a typed error and never hits the network.
//
// HJ's side is LIVE and deployed (HJ #1450, migration 549) — this is the ready-to-flip
// consumer; only the shared secret + our flag stand between it and working. The
// request/response shapes and the B1 `usage` envelope are ratified; `usage` is still read
// defensively (an older HJ build simply omits it, and a missing envelope is not an error).

import { hjBackendUrl, partnerSecret, partnerAudioEnabled, PARTNER_ID } from './config';
import { getGrantToken, getActiveGrant, touchGrant } from './grants';
import type {
  ProvisionError,
  ProvisionErrorCode,
  ProvisionUsage,
  VoiceBasis,
  WelcomeResult,
  TestimonialResult,
} from './types';

/**
 * Read the B1 `usage` envelope defensively. `fallbackBasis` is what we may assume when HJ
 * omits the basis: 'narrator' for testimonials (HJ renders those narrator-always, so
 * assuming it can only under-claim), and nothing for a welcome — an unknown basis must
 * stay unknown rather than become an "in your voice" claim we can't stand behind.
 */
export function readUsage(raw: unknown, fallbackBasis?: VoiceBasis): ProvisionUsage | undefined {
  if (!raw || typeof raw !== 'object') return fallbackBasis ? { voice_basis: fallbackBasis } : undefined;
  const u = raw as Record<string, unknown>;
  const basis = u.voice_basis === 'self' || u.voice_basis === 'narrator' ? (u.voice_basis as VoiceBasis) : fallbackBasis;
  return {
    owner_id: typeof u.owner_id === 'string' ? u.owner_id : undefined,
    embed_id: typeof u.embed_id === 'string' ? u.embed_id : undefined,
    render_chars: typeof u.render_chars === 'number' ? u.render_chars : undefined,
    billed: typeof u.billed === 'boolean' ? u.billed : undefined,
    quota_remaining: typeof u.quota_remaining === 'number' ? u.quota_remaining : null,
    ...(basis ? { voice_basis: basis } : {}),
  };
}

/**
 * Map an HJ HTTP error to our typed code (contract §"Error contract"). HJ's 403s are
 * distinguished by message — the exact strings come from its `checkGrant`:
 *   'grant scope does not permit this action' · 'grant is not valid for this embed' ·
 *   'grant does not permit third-party voice' (the consent-v2 bright line).
 * Test the voice case FIRST: its message mentions neither "embed" nor a scope, and
 * collapsing it into `grant_scope` would hide a consent refusal behind a permissions error.
 */
export function codeForStatus(status: number, body: unknown): ProvisionErrorCode {
  const msg = typeof (body as { error?: string })?.error === 'string' ? (body as { error?: string }).error! : '';
  if (status === 401) return /revoked|grant/i.test(msg) ? 'invalid_or_revoked_grant' : 'invalid_partner_key';
  if (status === 402) return 'partner_quota_exceeded';
  if (status === 403) {
    if (/third[-\s]?party|voice/i.test(msg)) return 'voice_third_party';
    return /embed/i.test(msg) ? 'grant_embed_mismatch' : 'grant_scope';
  }
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
    // No fallback basis: HJ returns 'self' only when the embed's voice is a clone, so an
    // absent envelope means "we don't know whose voice this is" — say nothing, not "yours".
    usage: readUsage(b.usage),
  };
}

/**
 * A single narrated testimonial (fixed quote). Narrator-always by contract — a customer's
 * words are never rendered in a cloned voice through these rails (that would be
 * `voice:third_party`, which a partner grant can't reach).
 */
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
    usage: readUsage(b.usage, 'narrator'),
  };
}
