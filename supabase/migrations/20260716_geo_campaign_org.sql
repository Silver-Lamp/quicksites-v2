-- Per-campaign org ownership for geo-domain outreach campaigns.
--
-- Lets a campaign belong to an org (e.g. the CedarSites reseller org) so every
-- prospect-facing surface — postcard, claim page, tracked links, emails — reflects that
-- org's brand instead of the QuickSites default. Nullable: a null org_id means the
-- QuickSites default brand (legacy behavior). New campaigns default to OUTREACH_DEFAULT_ORG_SLUG
-- at creation (in lib/outreach/geoCampaigns.ts), and an operator can switch any campaign.
--
-- Idempotent. Pending — run `npm run db:migrate:up`.

alter table public.geo_industry_campaigns
  add column if not exists org_id uuid references public.organizations(id);

create index if not exists geo_industry_campaigns_org_id_idx
  on public.geo_industry_campaigns (org_id);
