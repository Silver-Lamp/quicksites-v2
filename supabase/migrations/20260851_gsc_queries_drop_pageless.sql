-- 20260851_gsc_queries_drop_pageless.sql
--
-- ⚠️ THE PAGE DIMENSION SILENTLY DOUBLED EVERY RE-HARVESTED ROW. The first harvest asked Google
-- for ['query'] only, so those rows carry page = '' (20260850 made the column NOT NULL DEFAULT '').
-- The next harvest asked for ['query','page'] and wrote the SAME impressions again under the real
-- page — and because `page` is part of the unique key, the upsert saw a different row rather than
-- a conflict. 292 pageless rows, every one with a real-page twin: 2,224 impressions counted twice
-- out of 8,815, a ~25% inflation of every total that had already been reported.
--
-- Nothing about it looked wrong. The row counts went UP, which reads as more data.
--
-- Delete only a pageless row that HAS a real-page twin for the same (domain, query, window). A
-- pageless row with no twin is the only record of that measurement and is kept.

delete from public.gsc_queries a
where a.page = ''
  and exists (
    select 1
    from public.gsc_queries b
    where b.domain = a.domain
      and b.query = a.query
      and b.start_date = a.start_date
      and b.end_date = a.end_date
      and b.page <> ''
  );
