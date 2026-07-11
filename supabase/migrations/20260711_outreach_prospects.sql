-- "Businesses near me" geographic lead-gen fan-out.
--
-- Parks businesses discovered via a Google Places Nearby Search sweep BEFORE any AI
-- is spent building a draft site. The operator reviews the list (filtered by lead
-- tier: no website / dated site / has a decent site) and selectively promotes rows
-- into the existing CedarSites build-and-claim pipeline (claim_source='listing_import'
-- on `templates`). This table is the discovery front-end that pipeline lacked.
--
-- Service-role/server only: RLS on + no policies denies anon/authenticated by default
-- (same pattern as public.site_settings). All access goes through admin-gated routes.

create table if not exists public.outreach_prospects (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  discovered_by   uuid,                                   -- operator uid who ran the sweep
  sweep_id        uuid,                                   -- groups one geographic search
  place_id        text not null,                          -- Google place id (dedupe key)
  source          text not null default 'google_places',
  business_name   text not null,
  phone           text,
  address         text,
  address_lat     double precision,
  address_lon     double precision,
  city            text,                                   -- the sweep's city (for grouping)
  region          text,                                   -- the sweep's state/province
  industry_key    text,                                   -- derived from categories (for grouping + geo domain)
  categories      text[] not null default '{}',
  website         text,                                   -- null ⇒ "no website" tier
  freshness_score int,                                    -- 0–100; null when no website
  lead_tier       text not null default 'no_website',     -- 'no_website' | 'dated' | 'has_site'
  status          text not null default 'discovered',     -- 'discovered'|'draft_built'|'claimed'|'dismissed'
  template_id     uuid,                                   -- set once a draft is built
  geo_campaign_id uuid,                                   -- set when pitched a geo-industry domain
  postcard_sent_at timestamptz,                           -- outreach: physical postcard mailed
  sms_sent_at      timestamptz                            -- outreach: claim-link text sent
);

-- place_id dedupes re-sweeps of the same area (upsert on-conflict do-nothing).
create unique index if not exists outreach_prospects_place_id_key
  on public.outreach_prospects (place_id);

-- Funnel query: list by status + tier, newest first.
create index if not exists outreach_prospects_status_tier_idx
  on public.outreach_prospects (status, lead_tier, created_at desc);

alter table public.outreach_prospects enable row level security;

-- No policies on purpose: all reads/writes go through admin-gated server routes using
-- the service-role key (which bypasses RLS). RLS-on + no policies denies anon/auth.

comment on table public.outreach_prospects is
  'Geographic lead-gen prospects (Google Places sweep). Service-role/server only; RLS denies anon/auth by default. Promotes into templates(claim_source=listing_import).';
