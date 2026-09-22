-- 20260847_serp_observations.sql
--
-- One row per (query, location, run) — what the page looked like above the first organic result.
--
-- ⚠️ THE ROWS ARE THE POINT, NOT THE LATEST ANSWER. A SERP verdict has a shelf life: AI overviews
-- are rolling out across query classes right now and can turn a winnable page unwinnable with
-- nothing else changing. A niche we passed on in September may be open in March. So observations
-- ACCUMULATE (checked_at is part of the key) and nothing is ever overwritten — the trend is the
-- finding, and a single snapshot cannot show it.
--
-- `raw` keeps the provider's payload so a re-classification never needs a re-fetch: fetching
-- costs money, classifying is free, and the rules in lib/serp/classify.ts will change as the ten
-- manual searches calibrate them.
--
-- Service-role only (deny-default), like gsc_queries.

create table if not exists public.serp_observations (
  id uuid primary key default gen_random_uuid(),
  -- The niche this search was run for (lib/niches/candidates.ts key), when there is one.
  niche_key text,
  query text not null,
  location text not null,
  checked_at timestamptz not null default now(),
  provider text not null default 'dataforseo',

  pack_size integer not null default 0,
  ad_count integer not null default 0,
  ai_overview boolean not null default false,
  blocks_above integer not null default 0,
  first_organic_domain text,
  first_organic_kind text not null default 'unknown',
  first_organic_rank integer,
  verdict text not null,
  reason text,

  raw jsonb
);

create index if not exists serp_observations_niche_idx on public.serp_observations (niche_key, checked_at desc);
create index if not exists serp_observations_query_idx on public.serp_observations (query, location, checked_at desc);

alter table public.serp_observations enable row level security;
-- No policies on purpose — service-role only. See CLAUDE.md §6.
