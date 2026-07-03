-- SECURITY: give public.sites an owner and scope its RLS.
--
-- sites was the last RLS-DISABLED, anon+authenticated-writable table left after
-- Phase 3b (PR #118). It was deferred because it had NO owner column and a large
-- public-render + editor-write surface, so it couldn't be scoped without a schema
-- change. This adds that column, backfills what we can, and locks writes to the
-- owner (public reads stay open — sites are published public content).
--
-- Ownership model (verified against the live DB, 2026-07-02):
--   • 131 rows. Owner is derivable for 26 via the template that produced the site
--     (sites.template_id / sites.template_version_id → templates.owner_id).
--   • The other 105 are legacy/demo/orphan rows with no ownership signal
--     (template_id + company_id null). They keep owner_id = NULL and become
--     manageable ONLY by the service role / platform admins — which is the correct
--     posture: today ANY caller can edit them (the /site/[slug]/edit page and
--     /api/site/[id] have no ownership check; PostgREST anon writes are open).
--
-- Server clients use the service role and bypass RLS, so server-side reads/writes
-- (site resolution, admin tooling, publish) are unaffected by the policies below.

-- 1) owner column + index (no FK: other tables here reference user ids without one,
--    and a FK could fail on any stale uuid).
alter table public.sites add column if not exists owner_id uuid;
create index if not exists sites_owner_id_idx on public.sites (owner_id);

-- 2) backfill from the originating template's owner (two paths; idempotent).
update public.sites s
set owner_id = t.owner_id
from public.templates t
where t.id = s.template_id
  and s.owner_id is null
  and t.owner_id is not null;

update public.sites s
set owner_id = t.owner_id
from public.template_versions tv
join public.templates t on t.id = tv.template_id
where tv.id = s.template_version_id
  and s.owner_id is null
  and t.owner_id is not null;

-- 3) RLS: public read, owner/admin-scoped writes.
alter table public.sites enable row level security;

drop policy if exists sites_public_read on public.sites;
create policy sites_public_read on public.sites
  for select
  using (true);

drop policy if exists sites_insert_own on public.sites;
create policy sites_insert_own on public.sites
  for insert
  to authenticated
  with check (owner_id = auth.uid() or public.is_platform_admin());

drop policy if exists sites_update_own on public.sites;
create policy sites_update_own on public.sites
  for update
  to authenticated
  using (owner_id = auth.uid() or public.is_platform_admin())
  with check (owner_id = auth.uid() or public.is_platform_admin());

drop policy if exists sites_delete_own on public.sites;
create policy sites_delete_own on public.sites
  for delete
  to authenticated
  using (owner_id = auth.uid() or public.is_platform_admin());
