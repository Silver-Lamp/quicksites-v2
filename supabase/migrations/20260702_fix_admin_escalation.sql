-- SECURITY: close the privilege-escalation via self-written user_profiles.role.
--
-- is_platform_admin() trusted `user_profiles.role='admin'` OR membership in
-- admin_users. RLS lets a user insert/update THEIR OWN user_profiles row, so any
-- authenticated user (incl. an anonymous guest session) could self-assign
-- role='admin' and flip is_platform_admin() → true, unlocking every is_*admin()-
-- gated RLS policy (user_roles, leads, campaigns, chefs, …).
--
-- Fix: trust ONLY admin_users (a table normal users can't write). Verified safe —
-- the single user_profiles.role='admin' user is already in admin_users, so nobody
-- loses admin. The route-level gate (lib/auth/getAdminUser.ts) reads
-- app_metadata/ADMIN_EMAILS and is unaffected.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  );
$$;

-- Defense-in-depth: even though nothing should trust user_profiles.role for admin
-- anymore, forbid a non-admin from setting a privileged role on any profile. The
-- service role (server-side writes; auth.uid() is null) bypasses, so admins can
-- still promote users through server routes / the admin UI (their own uid is in
-- admin_users).
create or replace function public.guard_user_profiles_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  privileged constant text[] := array['admin','superadmin'];
begin
  if new.role = any(privileged)
     and (tg_op = 'INSERT' or new.role is distinct from old.role)
     and auth.uid() is not null
     and not exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  then
    raise exception 'not authorized to assign role %', new.role using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_user_profiles_role on public.user_profiles;
create trigger guard_user_profiles_role
  before insert or update on public.user_profiles
  for each row execute function public.guard_user_profiles_role();

revoke all on function public.guard_user_profiles_role() from public;
