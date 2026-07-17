-- Catalog gigs — the AisleAsk store-walk WEDGE board (crosstalk ideas.md §10 + §19).
-- A gig = a store that needs cataloging. A tasker (authed user) claims open gigs for the
-- day, then plans one efficient route across their claimed stores (/tools/route-planner)
-- and walks them with the Mentra glasses. This is the wedge board (mesh controls both
-- sides), NOT a general two-sided marketplace — and v0 has NO payments (§10 posture).
--
-- Deny-default RLS: service-role (server routes) only. Taskers read/claim via authed
-- server routes (requireUser); operators seed gigs via an admin route. No browser writes.
create table if not exists public.catalog_gigs (
  id             uuid primary key default gen_random_uuid(),
  store_name     text not null,
  address        text,                    -- street address (geocoded when no coords)
  latitude       double precision,        -- precise coords (from AisleAsk store geo when set)
  longitude      double precision,
  location_label text,                    -- free-text fallback ("Elm St, Austin")
  status         text not null default 'open',   -- 'open' | 'claimed' | 'completed'
  claimed_by     uuid,                    -- tasker user id (auth.users)
  claimed_at     timestamptz,
  completed_at   timestamptz,
  source         text not null default 'manual', -- 'manual' | 'aisleask'
  external_ref   text,                    -- optional AisleAsk store/catalog id for de-dupe
  notes          text,
  created_at     timestamptz not null default now()
);

create index if not exists catalog_gigs_status_idx on public.catalog_gigs (status, created_at desc);
create index if not exists catalog_gigs_claimed_idx on public.catalog_gigs (claimed_by, status);

alter table public.catalog_gigs enable row level security;
-- Deny-default: no policies → only the service role (server) reads/writes.
revoke all on public.catalog_gigs from anon, authenticated;
