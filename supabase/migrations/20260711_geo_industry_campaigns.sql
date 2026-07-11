-- Location-industry domain land-grab campaigns.
--
-- The SEO play behind the "businesses near me" fan-out: for a city + industry where
-- several businesses have no website (a "competition card"), QuickSites registers the
-- exact-match domain (e.g. boston-towing.com — a strong local-SEO asset it OWNS) and
-- stands up ONE claimable pitch site, then pitches it to the competing no-website
-- businesses. First to sign gets the domain pointed at their branded site; QuickSites
-- keeps the domain (lease). The pitch site's `templates.slug` == the apex label
-- (boston-towing), so middleware's arbitrary-custom-domain rewrite (host → /sites/<slug>)
-- serves it with no extra mapping once the domain is attached to Vercel.
--
-- Service-role/server only: RLS on + no policies denies anon/authenticated by default.

create table if not exists public.geo_industry_campaigns (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid,
  city           text not null,
  region         text,                                   -- state/province, for the domain + copy
  country        text,
  center_lat     double precision,
  center_lon     double precision,
  industry_key   text not null,
  domain         text not null,                          -- e.g. boston-towing.com (QuickSites-owned)
  slug           text not null,                          -- pitch-site slug == apex label (boston-towing)
  template_id    uuid,                                   -- the claimable pitch site
  domain_status  text not null default 'planned',        -- 'planned'|'available'|'unavailable'|'registered'|'attached'|'failed'
  status         text not null default 'draft',          -- 'draft'|'live'|'claimed'|'archived'
  claimed_by_prospect_id uuid,                            -- the business that claimed it
  notes          text
);

-- One campaign per exact-match domain.
create unique index if not exists geo_industry_campaigns_domain_key
  on public.geo_industry_campaigns (domain);

create index if not exists geo_industry_campaigns_status_idx
  on public.geo_industry_campaigns (status, created_at desc);

alter table public.geo_industry_campaigns enable row level security;

-- No policies: all access via admin-gated server routes using the service-role key.

comment on table public.geo_industry_campaigns is
  'Location-industry domain campaigns (boston-towing.com). Service-role/server only; RLS denies anon/auth. Pitch site served via templates.slug == apex label.';
