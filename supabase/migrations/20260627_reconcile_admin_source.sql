-- 20260627_reconcile_admin_source.sql
--
-- Reconcile the split admin source. Two notions of "admin" disagreed:
--   • admin_users table (used by whoami, templates policies, the old is_admin())
--   • user_profiles.role = 'admin' (used by the app's role hooks)
-- They named DIFFERENT users, so the real role-admin was treated as non-admin by
-- whoami/templates, and vice-versa.
--
-- Fix: make is_admin() authoritative across BOTH sources (delegates to
-- is_platform_admin), so every SQL consumer is consistent. (Inline admin_users
-- checks in whoami/templates are reconciled at the data level — see the one-off
-- insert run alongside this migration to add the role-admin to admin_users.)

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin();
$$;
