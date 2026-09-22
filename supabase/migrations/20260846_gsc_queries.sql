-- 20260846_gsc_queries.sql
--
-- Per-QUERY Search Console rows. Until now every GSC call this repo made asked for
-- `dimensions: ['page']` or no dimension at all, so we stored totals and never learned a single
-- word anyone typed. Across 92 connected domains that was 2,903 impressions and 18 clicks with
-- no idea what they were FOR.
--
-- One row per (domain, query, window). The window is part of the key so re-harvesting the same
-- 28 days updates in place, and a later window accumulates beside it rather than overwriting —
-- the point is the trend, not a snapshot.
--
-- Service-role only (deny-default): GSC data is scoped to whoever connected the property and
-- this table deliberately aggregates ACROSS properties, so there is no per-user read of it.

create table if not exists public.gsc_queries (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  query text not null,
  clicks integer not null default 0,
  impressions integer not null default 0,
  ctr numeric(6,4) not null default 0,
  position numeric(6,2) not null default 0,
  start_date date not null,
  end_date date not null,
  captured_at timestamptz not null default now()
);

create unique index if not exists gsc_queries_domain_query_window_uniq
  on public.gsc_queries (domain, query, start_date, end_date);

-- The striking-distance read: "ranked but not winning", newest window first.
create index if not exists gsc_queries_position_idx
  on public.gsc_queries (position, impressions desc);
create index if not exists gsc_queries_window_idx
  on public.gsc_queries (end_date desc);

alter table public.gsc_queries enable row level security;
-- No policies on purpose — service-role only. See CLAUDE.md §6.
