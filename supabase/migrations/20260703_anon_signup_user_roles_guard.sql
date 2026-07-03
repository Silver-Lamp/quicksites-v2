-- FIX: anonymous sign-ups fail with "Database error creating anonymous user".
--
-- The on_auth_user_created trigger runs handle_new_user_roles(), which inserts
-- new.email into public.user_roles(user_email). Anonymous users (signInAnonymously)
-- have a NULL email, and user_roles.user_email is NOT NULL — so the insert raises a
-- not-null violation, which rolls back the entire auth.users insert and surfaces as
-- a 500 from GoTrue. The trigger simply never handled the no-email case (it only
-- started mattering once anonymous sign-ins were enabled).
--
-- Guard the insert: skip when there's no email. Anonymous users don't belong in the
-- email-keyed user_roles table; if/when they claim a real account the app assigns
-- ownership via owner_id (the guest-build claim flow does not depend on user_roles).
create or replace function public.handle_new_user_roles()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Anonymous users have no email to key user_roles on — skip them.
  if new.email is null then
    return new;
  end if;

  insert into public.user_roles (user_email, role)
  values (new.email, 'viewer')
  on conflict (user_email) do nothing;

  return new;
end;
$function$;
