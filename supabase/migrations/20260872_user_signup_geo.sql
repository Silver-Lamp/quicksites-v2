-- 20260872_user_signup_geo.sql
--
-- Coarse location of the request a person first arrived on, so "where are our users coming
-- from" is answerable.
--
-- ⚠️ NO IP ADDRESS IS STORED, DELIBERATELY. Country/region/city answers the question; the IP
-- answers questions nobody asked and creates a PII store that then has to be governed, retained
-- and deleted. The geo is read from Vercel's edge headers and the address is dropped on the
-- floor in the same function.
--
-- ⚠️ FIRST TOUCH WINS — this is "where they signed up from", not "where they are now". The row
-- is inserted once and never updated, so a later visit from an airport does not rewrite history.
--
-- ⚠️ IT CANNOT BE BACKFILLED. Nothing captured these headers before today, and the only other
-- IP trail (`ratelimit_events.key`) is an abuse-control log that is not tied to a user id —
-- correlating it by timestamp would be an inference presented as a record. Existing users will
-- simply have no row, and the UI says "—" rather than guessing.

create table if not exists public.user_signup_geo (
  user_id uuid primary key references auth.users(id) on delete cascade,
  country text,
  region text,
  city text,
  -- Which surface observed it, for when a second capture point is added.
  source text not null default 'template_create',
  captured_at timestamptz not null default now()
);

create index if not exists user_signup_geo_country_idx on public.user_signup_geo (country);

alter table public.user_signup_geo enable row level security;
-- Deny-default: service-role only. Read through the admin-gated users API, never by a client.

comment on table public.user_signup_geo is
  'Coarse first-touch location per user (country/region/city). No IP is stored. Insert-once: first touch wins, so it means "signed up from", not "currently in". Not backfillable — nothing captured it before 2026-10-02.';
