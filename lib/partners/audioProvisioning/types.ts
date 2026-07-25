// lib/partners/audioProvisioning/types.ts
//
// Shared types for the HiveJournal audio provisioning consumer.
// Request/response shapes mirror crosstalk/contracts/partner-provisioning.md — the
// billing-rollup half (the `usage` envelope + the partner usage feed) was ratified
// as-proposed 2026-07-19, so these shapes are the contract, not a guess.

export type BillingMode = 'owner' | 'partner';

/**
 * Consent v2 (contract §"Consent v2 — voice bases"). Which consent a render stood on:
 * `self` = the granting owner's OWN cloned voice; `narrator` = the standard narrator voice.
 * A partner grant can NEVER reach `third_party` — HJ enforces that server-side and 403s
 * rather than silently downgrading, so it is deliberately absent from this union. We echo
 * the basis so the UI can label honestly and never imply a customer endorsed in their own
 * voice. HJ resolves it: welcome = `self` when the embed's voice is a clone, else
 * `narrator`; testimonials are **always** `narrator`.
 */
export type VoiceBasis = 'self' | 'narrator';

export type PartnerAudioGrant = {
  id: string;
  userId: string;
  templateId: string | null;
  hjEmbedId: string;
  hjOwnerId: string | null;
  scope: string;
  billingMode: BillingMode;
  status: 'active' | 'revoked';
};

/** The B1 usage envelope returned by the provision endpoints (contract §B1). */
export type ProvisionUsage = {
  owner_id?: string;
  embed_id?: string;
  render_chars?: number;
  billed?: boolean;
  quota_remaining?: number | null;
  /** Consent v2: which voice actually spoke. Read defensively — older HJ builds omit it. */
  voice_basis?: VoiceBasis;
};

export type WelcomeResult = {
  ok: true;
  welcome_id: string;
  audio_url: string;
  cached: boolean;
  usage?: ProvisionUsage;
};

export type TestimonialResult = {
  ok: true;
  testimonial_id: string;
  audio_url: string;
  cached: boolean;
  usage?: ProvisionUsage;
};

/** Documented error contract (contract §"Error contract"). */
export type ProvisionErrorCode =
  | 'disabled' // local: flag off / secret unset — never left the process
  | 'no_grant' // local: no stored active grant for this embed
  | 'invalid_partner_key' // 401
  | 'invalid_or_revoked_grant' // 401
  | 'grant_scope' // 403
  | 'grant_embed_mismatch' // 403
  | 'voice_third_party' // 403 — consent v2 bright line; HJ fails closed, never downgrades
  | 'quota_exceeded' // 429
  | 'partner_quota_exceeded' // 402
  | 'audio_not_configured' // 503
  | 'unknown';

export type ProvisionError = {
  ok: false;
  code: ProvisionErrorCode;
  status?: number;
  message?: string;
  retryAfter?: number | null;
  quotaRemaining?: number | null;
};

/** A row of the B2 partner usage feed (contract §B2). */
export type PartnerUsageRow = {
  owner_id: string;
  embed_id: string;
  renders: number;
  render_chars: number;
  est_cost_usd: number;
  last_render_at?: string | null;
};

export type PartnerUsageFeed = {
  partner: string;
  period: { since: string; until: string };
  owners: PartnerUsageRow[];
  totals: { renders: number; render_chars: number; est_cost_usd: number };
};
