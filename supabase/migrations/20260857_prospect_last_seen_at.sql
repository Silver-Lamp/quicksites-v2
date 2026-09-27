-- 20260857_prospect_last_seen_at.sql
--
-- WHEN DID WE LAST CONFIRM THIS BUSINESS EXISTS — as distinct from when we first noticed it.
--
-- ⚠️ `created_at` was standing in for freshness, and it cannot: `upsertProspects` sets
-- `ignoreDuplicates: true` (deliberately — a re-sweep must not clobber a worked lead), so a row
-- is stamped once and never touched again however many times the city is swept.
--
-- The failure that exposed it: all 15 Renton towing rows carry `created_at = 2026-07-14`. A
-- sweep on 2026-09-27 re-observed 17 businesses there and inserted 0, because they all already
-- existed — so the forward-to recommender still called the pool `stale` and advised "re-sweep
-- this city", immediately after that city had been swept. **Advice that the operator cannot
-- satisfy by following it**, which is worse than no advice: it reads as a real finding and sends
-- them in a loop.
--
-- `last_seen_at` is written for every place id a sweep observes, inserted or not. Backfilled to
-- `created_at` so existing rows keep their current (honest, if pessimistic) age rather than
-- pretending to be fresh.

alter table public.outreach_prospects
  add column if not exists last_seen_at timestamptz;

update public.outreach_prospects
   set last_seen_at = created_at
 where last_seen_at is null;

create index if not exists outreach_prospects_last_seen_at_idx
  on public.outreach_prospects (last_seen_at desc nulls last);

comment on column public.outreach_prospects.last_seen_at is
  'Last time a sweep observed this place. Distinct from created_at, which a dedupe-ignoring upsert freezes at first sight — see 20260857.';
