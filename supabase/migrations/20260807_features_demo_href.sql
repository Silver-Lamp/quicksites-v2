-- features.demo_href — a "See it live" destination, distinct from doc_href.
--
-- Why a second column rather than reusing doc_href: the gallery labels that button
-- "Read docs", and two live features shipped pointing it at "/" — the homepage. The
-- homepage was not a wrong *destination* for them (it carries a live In Your Voice
-- section); the wrong part was the promise. A feature can legitimately have a working
-- demo and no documentation, so the two need separate fields and separate labels.
--
-- Nullable and additive: existing rows are unaffected and the button simply doesn't render.

alter table if exists public.features
  add column if not exists demo_href text;

comment on column public.features.demo_href is
  'Optional "See it live" link (a working demo/section). Distinct from doc_href, which promises documentation.';
