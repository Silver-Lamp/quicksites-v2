-- 20260878_outreach_prospects_site_provider.sql
--
-- Who hosts the business's current website (wix / squarespace / godaddy / wordpress / weebly /
-- duda / webflow / shopify / bentobox / popmenu / custom), read from the site's own HTML by
-- lib/prospects/siteProvider.ts during the ordering check. The Evolve page uses it to show the
-- provider's PUBLISHED pricing beside their current site — never a guess at their plan.
-- NULL = never read (same rule as ordering_platform).
alter table public.outreach_prospects
  add column if not exists site_provider text;

comment on column public.outreach_prospects.site_provider is
  'Hosting/builder the business''s own site is served by, read from its HTML. NULL = never read; custom = read, no known builder.';
