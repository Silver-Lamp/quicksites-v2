-- 20260811_menu_search_events.sql
--
-- What people looked for on a city menu directory, and HOW MANY DISHES THEY FOUND.
--
-- The zero-result rows are the point. "12 people called you" sells a restaurant its own
-- existing customers; "47 people searched for vegan pad thai near you last month and found
-- nobody serving it" names revenue that does not exist yet, and no incumbent produces it —
-- Google knows what people search but does not sell dish-level unmet demand to operators.
-- That signal is a byproduct of the tag-search and it was being thrown away: the menu-finder
-- filters entirely client-side, so every "no results" vanished the moment the visitor gave up.
--
-- ⚠️ DELIBERATELY NO PII, AND NO PERSON-LEVEL ROW. No user id, no session id, no IP, no
-- fingerprint — the unit is a SEARCH, not a searcher. Two reasons, both load-bearing:
--   1. The product is an aggregate ("47 people wanted X"), so per-person data adds nothing a
--      count doesn't, while adding every obligation that comes with holding it.
--   2. PorchHearth's line: measure at the point you legitimately own. A query typed into our
--      own search box is ours; who typed it is not our business.
-- Rate limiting handles abuse at the edge (lib/api/rateLimitGuard), which is where it belongs.
--
-- Deny-default RLS, service-role only — same posture as demand_events.

create table if not exists public.menu_search_events (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.geo_industry_campaigns(id) on delete cascade,
  city          text,
  -- The free-text query as typed, trimmed + lowercased by the caller. Kept because the
  -- *words* are the product: "pad thai" and "thai noodles" are different demand signals.
  query         text,
  -- Tag chips selected at the moment of the search.
  tags          text[] not null default '{}',
  -- 0 is the valuable value. Indexed below for exactly that reason.
  result_count  integer not null,
  -- Whether the visitor had "open now" on — a zero-result at 11pm means something different
  -- from a zero-result at noon, and conflating them would overstate unmet demand.
  open_only     boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists menu_search_events_campaign_idx
  on public.menu_search_events (campaign_id, created_at desc);

-- The unmet-demand query: zero results, by city, over a window.
create index if not exists menu_search_events_unmet_idx
  on public.menu_search_events (campaign_id, created_at desc)
  where result_count = 0;

alter table public.menu_search_events enable row level security;

-- Deny-default: no policies. Only the service role reads or writes, exactly like
-- demand_events. A public search log that the public can read is a different product.
