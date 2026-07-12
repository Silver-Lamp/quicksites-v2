-- "Next steps" recommendations for geo-domain campaigns (see docs/GEO_RECOMMENDATIONS_PLAN.md).
-- Two dimensions stored together: { ranking: Rec[], nextAction: NextAction }.

alter table public.geo_industry_campaigns
  add column if not exists recommendations         jsonb not null default '[]'::jsonb,
  add column if not exists recommendations_synced_at timestamptz,
  add column if not exists claim_link_visits       int not null default 0;  -- intent counter

-- GBP prominence for the review benchmark (winner + competition roster). Throttled refresh.
alter table public.outreach_prospects
  add column if not exists rating                  numeric,
  add column if not exists review_count            int,
  add column if not exists place_signals_synced_at timestamptz;
