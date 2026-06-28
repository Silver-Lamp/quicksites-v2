-- 20260627_rls_user_profiles.sql
--
-- SECURITY: user_profiles (email, role, PII) was readable/writable by the public
-- anon key (RLS disabled). Lock it with owner-or-admin policies.
--
-- Access patterns it must preserve:
--   • role-resolution hooks (useSession/useCurrentRole/...) read the caller's OWN
--     row: select role where user_id = auth.uid()  → owner-scope covers this.
--   • admin user-management (profile-form approve, /admin/users) reads/writes ALL
--     rows via the browser anon client → needs an admin predicate.
--
-- Admin sources are split in this DB: admin_users has one user, but the app's
-- real admin is user_profiles.role='admin' (a DIFFERENT user). The existing
-- is_admin() only checks admin_users, so it would lock the real admin out.
-- Use a predicate covering BOTH. SECURITY DEFINER bypasses RLS inside the function
-- so referencing user_profiles here does not recurse.

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles up
    where up.user_id = auth.uid() and up.role = 'admin'
  ) or exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid()
  );
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to anon, authenticated, service_role;

alter table public.user_profiles enable row level security;

drop policy if exists user_profiles_select on public.user_profiles;
create policy user_profiles_select on public.user_profiles
  for select
  using (auth.uid() = user_id or public.is_platform_admin());

drop policy if exists user_profiles_insert on public.user_profiles;
create policy user_profiles_insert on public.user_profiles
  for insert
  with check (auth.uid() = user_id or public.is_platform_admin());

drop policy if exists user_profiles_update on public.user_profiles;
create policy user_profiles_update on public.user_profiles
  for update
  using (auth.uid() = user_id or public.is_platform_admin())
  with check (auth.uid() = user_id or public.is_platform_admin());

drop policy if exists user_profiles_delete on public.user_profiles;
create policy user_profiles_delete on public.user_profiles
  for delete
  using (public.is_platform_admin());
