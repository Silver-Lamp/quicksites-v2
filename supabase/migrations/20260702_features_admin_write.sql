-- SECURITY (Phase 3b): close the `features` write hole.
--
-- `features` had `Authenticated can insert/update` policies with a literal `true`
-- check → ANY authenticated user (incl. an anonymous guest session) could
-- insert/update ANY feature row (feature videos / showcase flags). The admin
-- features pages (app/admin/features/*) rely on those permissive policies (they
-- write with a null org_id, so the org-member `features_write` policy doesn't
-- match). Replace the `true` policies with a platform-admin policy — safe now that
-- is_platform_admin() trusts only admin_users (Phase 1). Legit paths preserved:
--   • org members  → existing features_write (org_members membership)
--   • platform admins (the admin pages) → new features_admin_write
--   • everyone else → denied.
drop policy if exists "Authenticated can insert features" on public.features;
drop policy if exists "Authenticated can update features" on public.features;

create policy features_admin_write on public.features
  for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
