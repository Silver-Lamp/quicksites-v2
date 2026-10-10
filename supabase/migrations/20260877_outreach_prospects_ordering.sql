-- 20260877_outreach_prospects_ordering.sql
--
-- Which online-ordering platform a swept business's OWN website links to, read from the site
-- (lib/prospects/orderingDetect.ts). The segment this exists for is "has a website, takes no
-- online orders" — the restaurant for which a no-monthly ordering page has nothing to beat —
-- and its sibling "orders only through a third-party app" (DoorDash/Grubhub/UberEats), which
-- pays a commission ours undercuts at any volume.
--
-- NULL ordering_checked_at means NOBODY LOOKED; it must never read as "no ordering". The
-- platform value 'none' is the positive finding that the site was read and linked nothing.
alter table public.outreach_prospects
  add column if not exists ordering_platform text,
  add column if not exists ordering_checked_at timestamptz,
  add column if not exists ordering_evidence text[];

comment on column public.outreach_prospects.ordering_platform is
  'Ordering platform the business''s own site links to (toast/square/clover/doordash/…/none). NULL = never checked; none = checked, nothing linked.';
comment on column public.outreach_prospects.ordering_checked_at is
  'When ordering_platform was last read from the site. NULL = never checked.';
comment on column public.outreach_prospects.ordering_evidence is
  'The matched hosts (e.g. order.toasttab.com), so a reader can see why — never prose.';

create index if not exists outreach_prospects_city_ordering_idx
  on public.outreach_prospects (city, ordering_platform)
  where website is not null;
