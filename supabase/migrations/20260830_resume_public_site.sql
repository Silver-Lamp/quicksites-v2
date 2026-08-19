-- 20260830_resume_public_site.sql
--
-- Fixes a real leak in 20260824: "public" was scoped to the OWNER, not to a SITE.
--
-- ⚠️ WHAT THAT ACTUALLY DID. The public download resolved `slug → owner → that owner's public
-- version`, so every site the owner had served their résumé. On the account this was built for
-- that is **2,227 templates** — and because the outgoing filename is built from the *requested
-- site's* business name, `/api/resume/starter-personal/pdf` returned one person's résumé under
-- another person's name (`Alex-Rivera-Resume.pdf`). Both halves are wrong, and the second is the
-- kind of wrong that looks deliberate to whoever downloads it.
--
-- The cause was a modelling shortcut that reads as harmless: an owner has one résumé, so key it to
-- the owner. But this product's owners are agencies with client sites, so "the sites you own" is
-- emphatically not "the site that is about you". Publishing is a property of a **site**, so it is
-- now stored on the site.
--
-- Found by asking for a site the feature was NOT built for — the 200 that should have been a 404.
-- Every check pointed at `sandon` passed, and would have kept passing.

alter table public.resume_versions
  add column if not exists public_site_id uuid
  references public.templates(id) on delete set null;

comment on column public.resume_versions.public_site_id is
  'The ONE site that serves this version publicly. Scoping "public" to the owner instead leaked a résumé across every site they own — see the migration header.';

-- Nothing may be public without naming the site it is public ON. Without this, a row could go
-- public with a null site and be served by nothing — or, worse, invite a future "fall back to the
-- owner's sites" convenience that reintroduces exactly the bug above.
alter table public.resume_versions
  drop constraint if exists resume_versions_public_needs_site;
alter table public.resume_versions
  add constraint resume_versions_public_needs_site
  check (not is_public or public_site_id is not null);

-- One public résumé per SITE (was: per owner).
drop index if exists public.resume_versions_one_public_per_owner;
create unique index if not exists resume_versions_one_public_per_site
  on public.resume_versions (public_site_id) where is_public;

create index if not exists resume_versions_public_site_idx
  on public.resume_versions (public_site_id);
