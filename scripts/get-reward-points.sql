create or replace function get_total_reward_points(user_id uuid)
returns int as $$
  select coalesce(sum(points), 0)
  from (
    select points from steward_rewards where user_id = get_total_reward_points.user_id
    union all
    select reward_points from referrals where referrer_id = get_total_reward_points.user_id
  ) as all_points;
$$ language sql;
