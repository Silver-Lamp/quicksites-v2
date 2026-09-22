-- 20260850_gsc_queries_page_notnull.sql
--
-- 20260848 keyed the table on `coalesce(page, '')` to make NULL pages dedupe. That is correct SQL
-- and unusable from PostgREST: an upsert names CONFLICT COLUMNS, and a column list cannot match an
-- EXPRESSION index — every write failed with "there is no unique or exclusion constraint matching
-- the ON CONFLICT specification".
--
-- So put the coalesce in the column instead: `page` is NOT NULL DEFAULT '' and the index is plain.
-- Empty string means "this row was harvested before the page dimension was requested", which is a
-- real distinction we keep rather than pretending those rows have a page.

update public.gsc_queries set page = '' where page is null;

alter table public.gsc_queries
  alter column page set default '',
  alter column page set not null;

drop index if exists gsc_queries_domain_query_page_window_uniq;
create unique index if not exists gsc_queries_domain_query_page_window_uniq
  on public.gsc_queries (domain, query, page, start_date, end_date);
