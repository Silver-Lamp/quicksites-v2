// lib/rehearsal/config.ts
//
// Env config + feature flag for the QuickSites → HiveJournal rehearsal-engine consumer
// (crosstalk/contracts/rehearsal-engine.md). Server-only.
//
// HJ builds and owns the engine; QuickSites hosts it as an internal tool and sells that on to
// companies. So every call we make is a PARTNER call — there is no owner-JWT path on their route
// (a turn acts on nothing an account owns), and usage belongs to us, who bill our own customers.
//
// ⚠️ Only ONE new secret is needed, which is easy to get wrong in the other direction.
// Their route resolves the grant through the same `resolveGrantRecord(partnerId, key, grant)` the
// About That routes use, so `X-Partner-Id` and `X-Partner-Key` are the partner credentials this
// repo ALREADY has from audio provisioning. The new value is the grant token itself, minted in
// HiveJournal with scope `rehearsal:practice` — an HJ owner action; a session cannot mint one.
//
// Host: the BACKEND host, not www — verified in their source (apps/backend/src/routes/rehearsal.ts),
// the same convention as lib/partners/audioProvisioning/config.ts.
import { PARTNER_ID, hjBackendUrl, partnerSecret } from '@/lib/partners/audioProvisioning/config';

export const PRACTICE_SCOPE = 'rehearsal:practice' as const;

/** The grant token minted in HiveJournal for this partner, scoped to rehearsal practice. */
export function practiceGrant(): string {
  return process.env.HJ_REHEARSAL_GRANT || '';
}

export function rehearsalTurnUrl(): string {
  return `${hjBackendUrl()}/api/rehearsal/turn`;
}

/**
 * Feature flag. OFF unless explicitly enabled AND every credential the call needs is present.
 *
 * Half-enabling is the failure this repo keeps having: partner audio sat inert for five days on
 * one of three variables while everything reported fine. A call with a missing grant does not
 * degrade — HJ fails closed on every branch of their gate — so there is nothing to gain by
 * letting the flag be true without it.
 */
export function rehearsalEnabled(): boolean {
  const on =
    process.env.REHEARSAL_PRACTICE_ENABLED === '1' ||
    process.env.REHEARSAL_PRACTICE_ENABLED === 'true';
  return on && !!partnerSecret() && !!practiceGrant();
}

/** The three headers their gate requires. Never log these. */
export function partnerHeaders(): Record<string, string> {
  return {
    'X-Partner-Id': PARTNER_ID,
    'X-Partner-Key': partnerSecret(),
    'X-Partner-Grant': practiceGrant(),
  };
}
