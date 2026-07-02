-- Helper: given a set of user ids, return the subset that are ANONYMOUS auth
-- users. Used to keep guest-built (still-unclaimed) sites off the public homepage
-- showcase as defense-in-depth — anon users can't publish, but this guarantees an
-- anon-owned row never surfaces even if one somehow gets published=true. Reading
-- auth.users requires security definer.
create or replace function public.anonymous_user_ids(p_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id from auth.users u
  where u.id = any(p_ids) and u.is_anonymous = true;
$$;

revoke all on function public.anonymous_user_ids(uuid[]) from public;
revoke all on function public.anonymous_user_ids(uuid[]) from anon;
revoke all on function public.anonymous_user_ids(uuid[]) from authenticated;
grant execute on function public.anonymous_user_ids(uuid[]) to service_role;
