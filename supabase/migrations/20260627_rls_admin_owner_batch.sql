-- 20260627_rls_admin_owner_batch.sql
--
-- SECURITY batch 4: tables accessed by the browser/user-context client that need
-- scoped policies (not deny-default). All admin predicates use is_admin() (now
-- both-source). service role bypasses RLS for server routes.

-- user_roles: a user reads their OWN role row (by user_id or user_email); admins
-- manage all. (useCurrentUser reads by user_email; role-manager is admin.)
alter table public.user_roles enable row level security;
drop policy if exists "Allow service role full access" on public.user_roles;
drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles for select
  using (user_id = auth.uid() or user_email = (auth.jwt() ->> 'email') or public.is_admin());
drop policy if exists user_roles_insert on public.user_roles;
create policy user_roles_insert on public.user_roles for insert with check (public.is_admin());
drop policy if exists user_roles_update on public.user_roles;
create policy user_roles_update on public.user_roles for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists user_roles_delete on public.user_roles;
create policy user_roles_delete on public.user_roles for delete using (public.is_admin());

-- session_logs: append-only telemetry inserted client-side; reads are admin-only
-- (rows carry email + token prefixes).
alter table public.session_logs enable row level security;
drop policy if exists "Allow service role full access" on public.session_logs;
drop policy if exists session_logs_insert on public.session_logs;
create policy session_logs_insert on public.session_logs for insert to anon, authenticated with check (true);
drop policy if exists session_logs_admin_select on public.session_logs;
create policy session_logs_admin_select on public.session_logs for select using (public.is_admin());

-- dashboard_access_log: append-only access log inserted client-side; admin-only read
-- (carries email + ip).
alter table public.dashboard_access_log enable row level security;
drop policy if exists "Allow service role full access" on public.dashboard_access_log;
drop policy if exists dashboard_access_log_insert on public.dashboard_access_log;
create policy dashboard_access_log_insert on public.dashboard_access_log for insert to anon, authenticated with check (true);
drop policy if exists dashboard_access_log_admin_select on public.dashboard_access_log;
create policy dashboard_access_log_admin_select on public.dashboard_access_log for select using (public.is_admin());

-- campaigns: admin-managed (contact_email/phone). All browser access is admin pages;
-- server create/update use the service role.
alter table public.campaigns enable row level security;
drop policy if exists "Allow service role full access" on public.campaigns;
drop policy if exists campaigns_admin_all on public.campaigns;
create policy campaigns_admin_all on public.campaigns for all using (public.is_admin()) with check (public.is_admin());

-- merchant_compliance_profiles: accessed by admin compliance routes via the
-- user-context client (kitchen_address PII). Admin-only.
alter table public.merchant_compliance_profiles enable row level security;
drop policy if exists "Allow service role full access" on public.merchant_compliance_profiles;
drop policy if exists mcp_admin_all on public.merchant_compliance_profiles;
create policy mcp_admin_all on public.merchant_compliance_profiles for all using (public.is_admin()) with check (public.is_admin());
