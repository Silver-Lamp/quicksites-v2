create or replace function daily_checkins_by_slug(slug text)
returns table (
  date date,
  count int
)
language sql
as $$
  select
    date_trunc('day', checked_at)::date as date,
    count(*)::int
  from tracking_checkins
  where slug = daily_checkins_by_slug.slug
  group by 1
  order by 1
$$;
