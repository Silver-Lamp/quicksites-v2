create or replace view public.block_feedback_summary as
select
  block_id,
  count(*) filter (where action = 'cheer') as cheer_count,
  count(*) filter (where action = 'echo') as echo_count,
  count(*) filter (where action = 'reflect') as reflect_count
from public.block_feedback
group by block_id;
