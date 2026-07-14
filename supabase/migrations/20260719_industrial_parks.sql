-- Industrial / flex-office park registry — grounds the geo pitch-site "default office
-- address" in a REAL commercial park instead of an LLM-hallucinated street.
--
-- Populated lazily: when we build a site in an area with no coverage yet, a Google
-- Places Text Search sweep ("industrial park", "business park", "flex office", …)
-- pulls the parks and stores them here (deduped by place_id). The suite scheme is
-- SYNTHETIC — Places has no unit/suite ranges — so a resolved address is a real
-- building + a deliberately-fictional suite (never a real tenant's unit).
--
-- industrial_park_sweeps records "we looked in this area" even when zero parks were
-- found, so the lazy ensure never re-hits Places for a genuinely-empty metro.
--
-- Service-role only (RLS enabled, no policies → deny-default for anon/auth), same as
-- outreach_prospects and the other geo/CRM tables.

create table if not exists public.industrial_parks (
  id             uuid primary key default gen_random_uuid(),
  place_id       text unique not null,
  name           text not null,
  street         text,
  city           text,
  region         text,
  postal_code    text,
  lat            double precision,
  lng            double precision,
  -- Inferred from the park name/keywords: 'flex' | 'warehouse' | 'light_mfg' | 'office'.
  permitted_uses text[] not null default '{}',
  -- Synthetic unit-numbering scheme, e.g. {"type":"range","from":100,"to":250}
  --                                        {"type":"building_letter","buildings":["A".."F"],"per":20}
  suite_scheme   jsonb not null default '{}'::jsonb,
  source         text not null default 'google_places_text',
  matched_query  text,
  verified_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists industrial_parks_area_idx on public.industrial_parks (city, region);

-- Coverage log: one row per (city, region) area we've swept, so ensure-for-area is O(1)
-- and never re-pulls Places for an area we've already looked at (even if it had 0 parks).
create table if not exists public.industrial_park_sweeps (
  area_key      text primary key,          -- normalized "<city>|<region>"
  city          text,
  region        text,
  lat           double precision,
  lng           double precision,
  radius_meters integer,
  parks_found   integer not null default 0,
  swept_by      uuid,
  swept_at      timestamptz not null default now()
);

alter table public.industrial_parks        enable row level security;
alter table public.industrial_park_sweeps  enable row level security;
