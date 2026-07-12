-- Refine-before-postcard readiness gate for geo-industry campaigns.
--
-- A geo pitch site must be marked refined before outreach (Mail/Text) can fire, so we
-- never mail a still-placeholder site. `outreach_blockers` caches the auto-detected
-- issues (recomputed by the geo-rank-sync cron); `outreach_ready_at` is the operator's
-- manual sign-off. The hard gate in the send routes is itself flag-gated
-- (OUTREACH_READINESS_GATE_ENABLED) so this schema is inert until turned on.
-- See docs/RANKED_TARGETING_PLAN.md.

alter table public.geo_industry_campaigns
  add column if not exists outreach_ready_at    timestamptz,
  add column if not exists outreach_reviewed_by uuid,
  add column if not exists outreach_blockers    jsonb;
