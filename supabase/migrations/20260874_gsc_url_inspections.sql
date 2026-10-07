-- 20260874_gsc_url_inspections.sql
--
-- The latest Search Console URL Inspection result per (property, url), with our triage of it.
--
-- ⚠️ WHY A TABLE AND NOT THE EMAILS. Search Console's "new reason preventing your pages from being
-- indexed" mails carry two facts — the property and a reason label — and none of the three that
-- resolve anything: which URLs, which canonical Google chose, and whether the page is now fixed.
-- The URL Inspection API answers all three per URL, so the nightly sweep stores that and the
-- admin page reads it. Latest-only (upsert): the question is "what is true now", and the
-- `inspected_at` column says how fresh "now" is.
--
-- `bucket` / `reason` / `remedy` are OUR classification (lib/gsc/indexingTriage.ts), computed at
-- write time from the same row, so the page shows what the sweep decided and a rule change
-- re-triages on the next sweep rather than silently reinterpreting history.
--
-- Deny-default RLS, service-role only: written by the cron, read by the admin page.

create table if not exists public.gsc_url_inspections (
  property text not null,
  url text not null,
  template_id uuid,
  inspected_at timestamptz not null default now(),
  verdict text,
  coverage_state text,
  indexing_state text,
  robots_txt_state text,
  page_fetch_state text,
  user_canonical text,
  google_canonical text,
  declared_canonical text,
  last_crawl_time timestamptz,
  crawled_as text,
  bucket text not null,
  reason text not null,
  remedy text,
  raw jsonb,
  primary key (property, url)
);

create index if not exists gsc_url_inspections_bucket_idx
  on public.gsc_url_inspections (bucket, property);

create index if not exists gsc_url_inspections_template_idx
  on public.gsc_url_inspections (template_id);

alter table public.gsc_url_inspections enable row level security;

-- Deny-default: no policy on purpose. Service-role bypasses RLS; everyone else gets nothing.

comment on table public.gsc_url_inspections is
  'Latest Search Console URL Inspection per (property, url) plus our triage bucket/reason/remedy, written by /api/cron/gsc-url-inspect. Service-role only.';
