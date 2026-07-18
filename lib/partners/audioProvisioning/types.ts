// lib/partners/audioProvisioning/types.ts
//
// Shared types for the HiveJournal audio provisioning consumer.
// Request/response shapes mirror crosstalk/contracts/partner-provisioning.md.
// The `usage` envelope + the partner usage feed are PROPOSED (pending HJ
// ratification of the billing-rollup half) — marked so, cheap to adjust.

export type BillingMode = 'owner' | 'partner';

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

/** PROPOSED usage envelope returned by the provision endpoints (contract §1). */
export type ProvisionUsage = {
  owner_id?: string;
  embed_id?: string;
  render_chars?: number;
  billed?: boolean;
  quota_remaining?: number | null;
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
  | 'quota_exceeded' // 429
  | 'partner_quota_exceeded' // 402 (PROPOSED)
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

/** PROPOSED partner usage feed row (contract §2). */
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
