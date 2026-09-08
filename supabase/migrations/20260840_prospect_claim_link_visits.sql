-- 20260840_prospect_claim_link_visits.sql
--
-- Per-prospect claim-link visits for the trade-site claim postcard (docs/TRADE_SITES_PIPELINE.md,
-- PR 3). The geo rail counts visits on the CAMPAIGN (claim_link_visits on geo_industry_campaigns);
-- a per-business draft has no campaign, so the count lives on the prospect. "They opened the
-- link" is the only signal between a postcard landing and a claim, and the postcard-to-claim
-- rate is the number that decides whether postage is worth spending.

alter table public.outreach_prospects add column if not exists claim_link_visits int not null default 0;
alter table public.outreach_prospects add column if not exists claim_link_visited_at timestamptz;
