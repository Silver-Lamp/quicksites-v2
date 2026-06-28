-- 20260627_rls_leads.sql
--
-- SECURITY: leads (email + outreach PII) was readable/writable via the public anon
-- key (RLS disabled). The public /claim flow's lead read/write has been moved to a
-- service-role server route (app/api/claim/lead), so the anon key needs NO leads
-- access. Remaining browser access is the admin dashboards (campaigns, leads list,
-- grid-map, print, useCampaignForm), which run as a logged-in admin.
--
-- Policy: platform admins (is_platform_admin) may read/update/delete via the browser;
-- all writes from server routes use the service role (bypasses RLS). Anon + non-admin
-- authenticated users (incl. guests) get nothing.

alter table public.leads enable row level security;

-- Pre-existing mis-scoped policy: named "Allow service role full access" but actually
-- TO public USING (true) → it granted EVERYONE (incl. anon) full access. service_role
-- bypasses RLS regardless, so this is both redundant and dangerous. Remove it.
drop policy if exists "Allow service role full access" on public.leads;

drop policy if exists leads_admin_select on public.leads;
create policy leads_admin_select on public.leads
  for select using (public.is_platform_admin());

drop policy if exists leads_admin_update on public.leads;
create policy leads_admin_update on public.leads
  for update using (public.is_platform_admin())
             with check (public.is_platform_admin());

drop policy if exists leads_admin_delete on public.leads;
create policy leads_admin_delete on public.leads
  for delete using (public.is_platform_admin());

-- (no insert policy → inserts only via service role, e.g. /api/claim/lead, campaigns)
