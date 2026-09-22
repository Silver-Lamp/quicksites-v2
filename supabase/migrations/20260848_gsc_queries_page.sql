-- 20260848_gsc_queries_page.sql
--
-- Which PAGE each query landed on. The first harvest asked for ['query'] alone, which made the
-- fleet's biggest single finding unactionable: one page was 21% of all impressions and nothing in
-- the row said which one. Excluding a page from a fleet aggregate then needs a name heuristic on
-- the query text — and a heuristic that guesses which searches are "personal" would be wrong in
-- both directions. With the page recorded, the exclusion is exact (lib/gsc/fleetScope.ts).
--
-- The unique key gains `page`: one query can legitimately land on two pages of the same site, and
-- collapsing them would silently discard one.

alter table public.gsc_queries add column if not exists page text;

drop index if exists gsc_queries_domain_query_window_uniq;
create unique index if not exists gsc_queries_domain_query_page_window_uniq
  on public.gsc_queries (domain, query, coalesce(page, ''), start_date, end_date);

create index if not exists gsc_queries_page_idx on public.gsc_queries (page);
