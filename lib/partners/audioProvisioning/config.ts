// lib/partners/audioProvisioning/config.ts
//
// Env config + feature flag for the QuickSites → HiveJournal audio provisioning
// consumer (crosstalk/contracts/partner-provisioning.md). Everything here is server-only.
//
// Default OFF. To enable in an environment, ALL of these must be set:
//   PARTNER_AUDIO_PROVISIONING_ENABLED = 1
//   PARTNER_QUICKSITES_SECRET          = <shared secret, also set on HJ's side>
//   PARTNER_GRANT_ENC_KEY              = <32-byte key, hex(64) or base64 — encrypts grants at rest>
// HJ's side is already live + deployed (HJ #1450, its migration 549), so the shared secret
// is the last coordination step: the same value must be set on both sides.
//
// Host convention (contract): API calls go to the BACKEND host, not www.

export const PARTNER_ID = 'quicksites' as const;
export const PROVISION_SCOPE = 'about_that:provision' as const;

/** HiveJournal backend host that serves the /api/about-that/* + /api/partner/* endpoints. */
export function hjBackendUrl(): string {
  return (
    process.env.HJ_BACKEND_URL ||
    'https://hivejournalbackend-production.up.railway.app'
  ).replace(/\/+$/, '');
}

/** The shared partner secret (proves the caller is QuickSites). */
export function partnerSecret(): string {
  return process.env.PARTNER_QUICKSITES_SECRET || '';
}

/**
 * Feature flag. OFF unless explicitly enabled AND the load-bearing secrets are present —
 * we never half-enable a flow whose calls would fail closed or whose grants couldn't be
 * encrypted at rest.
 */
export function partnerAudioEnabled(): boolean {
  const on =
    process.env.PARTNER_AUDIO_PROVISIONING_ENABLED === '1' ||
    process.env.PARTNER_AUDIO_PROVISIONING_ENABLED === 'true';
  return on && !!partnerSecret() && !!process.env.PARTNER_GRANT_ENC_KEY;
}
