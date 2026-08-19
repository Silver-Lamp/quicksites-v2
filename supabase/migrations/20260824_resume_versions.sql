-- 20260824_resume_versions.sql
--
-- A private library of tailored résumé versions, with exactly one of them chosen for public
-- download on the owner's site.
--
-- ⚠️ THE LABEL AND THE DOCUMENT ARE TWO DIFFERENT PRIVACY CLASSES, AND CONFLATING THEM IS THE
-- WHOLE BUG THIS TABLE EXISTS TO AVOID. The document is something the owner may choose to publish.
-- The label — "Indeed — Distinguished Engineer, AI" — is the same fact `job_postings` protects:
-- *a named person is applying to a named company right now*. The obvious implementation puts the
-- tailoring in the filename and drops it in the existing PUBLIC `resumes` bucket, at which point
-- the disclosure is the URL itself, readable by anyone who has or guesses it, and no amount of
-- care elsewhere walks it back.
--
-- So:
--
-- 1. **Files live in a PRIVATE bucket at server-derived, opaque paths** (`<owner>/<version>/<fmt>`).
--    No company name is ever expressible in a storage path, because the client never supplies one.
--
-- 2. **Nothing is served straight from storage.** Both the public download and the owner's own
--    preview stream through routes that set the outgoing filename. A recruiter's Downloads folder
--    gets `Sandon-Jurowski-Resume.pdf`, never `…-Indeed-DistinguishedEngineerAI.pdf` — a file is
--    forwarded, and a filename that names a different employer is the leak arriving by hand.
--
-- 3. **Owner-scoped RLS with no admin bypass**, matching `job_postings` (20260823). The list of
--    versions is a list of who you are applying to, one indirection removed. There is no operator
--    view and no support path, for the same reason there is none there.
--
-- 4. **`on delete cascade` from auth.users**, so account deletion actually deletes this.
--
-- ⚠️ WHAT THIS DOES NOT DO: switching the public choice does not un-publish what someone already
-- downloaded or a crawler already fetched. "Public" is one-way in practice; the switch controls
-- what is served *next*, and the UI says so rather than implying a recall.

create table if not exists public.resume_versions (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,

  -- Private, and expected to name the target ("Indeed — Distinguished Engineer, AI"). It is safe
  -- to be specific here precisely because this column never reaches a URL, a path, or a page.
  label      text not null,
  notes      text,

  -- [{ format, ext, path, size_bytes, content_type }] — `path` is server-derived, never client-set.
  files      jsonb not null default '[]'::jsonb,

  -- At most one true per owner; see the partial unique index below.
  is_public  boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint resume_versions_label_present check (nullif(btrim(label), '') is not null),
  constraint resume_versions_files_is_array check (jsonb_typeof(files) = 'array')
);

-- ⚠️ The "only one public" rule is an INDEX, not application code. Two rows marked public is not a
-- cosmetic glitch: it makes "which résumé does the world see" unanswerable, and the answer would
-- then depend on row order. A partial unique index makes the second one fail loudly instead.
create unique index if not exists resume_versions_one_public_per_owner
  on public.resume_versions (owner_id) where is_public;

create index if not exists resume_versions_owner_idx
  on public.resume_versions (owner_id, created_at desc);

comment on table public.resume_versions is
  'Private résumé version library. Owner-only by RLS — deliberately not readable by operators or admins.';
comment on column public.resume_versions.label is
  'Private. Names the tailoring target; never rendered publicly and never part of a storage path.';

alter table public.resume_versions enable row level security;

drop policy if exists resume_versions_select_own on public.resume_versions;
create policy resume_versions_select_own on public.resume_versions
  for select using (auth.uid() = owner_id);

drop policy if exists resume_versions_insert_own on public.resume_versions;
create policy resume_versions_insert_own on public.resume_versions
  for insert with check (auth.uid() = owner_id);

drop policy if exists resume_versions_update_own on public.resume_versions;
create policy resume_versions_update_own on public.resume_versions
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists resume_versions_delete_own on public.resume_versions;
create policy resume_versions_delete_own on public.resume_versions
  for delete using (auth.uid() = owner_id);

-- Which version a posting is being pursued with. `set null` rather than cascade: deleting a résumé
-- version must not silently delete the record of an application made with it.
alter table public.job_postings
  add column if not exists resume_version_id uuid
  references public.resume_versions(id) on delete set null;

create index if not exists job_postings_resume_version_idx
  on public.job_postings (resume_version_id);

-- The private bucket. `public = false` is the load-bearing value here; every other bucket in this
-- project is public, which is exactly why it is stated rather than assumed.
insert into storage.buckets (id, name, public, file_size_limit)
values ('resume-versions', 'resume-versions', false, 10485760)
on conflict (id) do update set public = false;
