create or replace function public.leaderboard_for_slug(slug text)
returns table (
  user_id uuid,
  total integer
)
language sql
as $$
  select user_id, count(*)::int as total
  from tracking_checkins
  where slug = leaderboard_for_slug.slug
  group by user_id
  order by total desc
  limit 25
$$;
