-- Distinguish the two geo-campaign models sharing this table:
--   'geo_services'           — the original: ONE shared exact-match pitch site, RENTED
--                              (boston-towing.com). Prospects compete for that single site.
--   'restaurant_competition' — NEW: a premium <city>-restaurant.com domain as the PRIZE for
--                              a cohort of no-website restaurants that each already got their
--                              OWN delivered.menu ordering site. First to claim wins the apex
--                              (a directory features them). Monetized by the per-order
--                              take-rate, NOT domain rent, so the domain is a free traffic bonus.
-- Existing rows default to 'geo_services' (correct — they're all the original model).
alter table public.geo_industry_campaigns
  add column if not exists kind text not null default 'geo_services';

create index if not exists geo_industry_campaigns_kind_idx
  on public.geo_industry_campaigns (kind, status, created_at desc);
