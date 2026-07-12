-- Phase 2: rank history time-series → trend recommendations (position improving/slipping,
-- impressions up / CTR down). See docs/GEO_RECOMMENDATIONS_PLAN.md.

create table if not exists public.geo_rank_history (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null,
  captured_at  timestamptz not null default now(),
  position     numeric,
  impressions  int,
  clicks       int,
  ctr          numeric
);

create index if not exists geo_rank_history_campaign_idx
  on public.geo_rank_history (campaign_id, captured_at desc);

alter table public.geo_rank_history enable row level security;
-- Service-role only (written by the geo-rank-sync cron; read by admin routes).

-- Compact latest trend for cheap UI/rec reads (positionDelta, impressionsDelta, ctr, …).
alter table public.geo_industry_campaigns
  add column if not exists rank_trend jsonb;
