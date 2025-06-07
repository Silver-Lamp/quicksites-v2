create or replace view public.checkin_map_points as
select
  block_id,
  tracking_checkins.slug,
  count(*) as total,
  round(avg(lat)::numeric, 5) as lat,
  round(avg(lon)::numeric, 5) as lon
from tracking_checkins
join blocks on tracking_checkins.block_id = blocks.id
where blocks.type = 'tracking'
group by block_id, tracking_checkins.slug;
