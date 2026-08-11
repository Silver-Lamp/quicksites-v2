-- 20260823_job_postings.sql
--
-- Saved job postings for the Verbatim job-seeker workspace.
--
-- ⚠️ THIS IS THE MOST SENSITIVE TABLE IN THE PRODUCT, AND IT DOES NOT LOOK LIKE IT. Everything
-- else we store is content someone chose to publish — a résumé page, a menu, a business listing.
-- A row here says **a named person is applying to a named company right now**, which is precisely
-- the fact most job seekers are hiding from their current employer. A leak is not embarrassing,
-- it is career damage, and it would be career damage we caused to someone who trusted us with a
-- private list.
--
-- So three things are deliberate:
--
-- 1. **Deny-default RLS with owner-scoped policies.** Not service-role-only: the owner reads and
--    writes their own rows through the browser, and NOBODY else reads them — no operator view, no
--    admin console, no "support can see it" convenience. There is no product reason for a
--    QuickSites employee to read who someone is applying to, so the schema does not permit it.
--    (Contrast `outreach_touches`, which is operator-only by design because it is OUR outreach.)
--
-- 2. **`on delete cascade` from auth.users.** Account deletion must actually delete this. A job
--    search is exactly the data someone comes back to erase, and a dangling row after a deleted
--    account is the version of that failure nobody notices until it matters.
--
-- 3. **No scraping column.** We store the URL the user pasted and any text they pasted with it.
--    We do NOT fetch the posting server-side: a job board fetched from our IP is fragile, often
--    against terms, and — the part that matters — it would mean OUR servers hold a copy of a page
--    the user only linked. Paste is a choice; fetch is a decision made for them.

create table if not exists public.job_postings (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,

  -- Which résumé this posting is being pursued with. Nullable: a posting saved before choosing.
  template_id uuid references public.templates(id) on delete set null,

  -- What the user pasted. `url` and `body` are both optional individually but one is required —
  -- a posting with neither is not a record of anything.
  url         text,
  company     text,
  title       text,
  body        text,
  -- The user's own notes: recruiter name, referral, what they want to emphasise.
  notes       text,

  -- Where they are in the process. Free text on purpose — the stages of a real job search are not
  -- ours to enumerate, and a migration to add "take-home" would be a silly reason to block someone
  -- recording where they actually are.
  stage       text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint job_postings_has_content
    check (nullif(btrim(coalesce(url, '')), '') is not null
        or nullif(btrim(coalesce(body, '')), '') is not null)
);

create index if not exists job_postings_owner_idx on public.job_postings (owner_id, created_at desc);
create index if not exists job_postings_template_idx on public.job_postings (template_id);

comment on table public.job_postings is
  'Private job-search records. Owner-only by RLS — deliberately not readable by operators or admins.';
comment on column public.job_postings.body is
  'Text the user pasted. We never fetch the posting server-side; see the migration header.';

alter table public.job_postings enable row level security;

-- Owner-scoped, all four verbs. No admin bypass policy: see note 1 above.
drop policy if exists job_postings_select_own on public.job_postings;
create policy job_postings_select_own on public.job_postings
  for select using (auth.uid() = owner_id);

drop policy if exists job_postings_insert_own on public.job_postings;
create policy job_postings_insert_own on public.job_postings
  for insert with check (auth.uid() = owner_id);

drop policy if exists job_postings_update_own on public.job_postings;
create policy job_postings_update_own on public.job_postings
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists job_postings_delete_own on public.job_postings;
create policy job_postings_delete_own on public.job_postings
  for delete using (auth.uid() = owner_id);
