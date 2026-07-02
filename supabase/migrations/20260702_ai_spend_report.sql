-- AI spend report for cost-abuse alerting.
--
-- Aggregates ai_usage_events over a window into one row, and — since the new
-- guest-build flow lets ANONYMOUS users trigger AI — breaks out spend/calls
-- attributable to anonymous auth users (a spike there = guest abuse). Reading
-- auth.users requires security definer.
--
-- NB: the live ai_usage_events table timestamps with `occurred_at` and stores the
-- route in `metadata->>'route'` (the repo's 20260626 metering migration diverged
-- from prod). This matches the live schema — verify columns before editing.
create or replace function public.ai_spend_report(p_since timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_top text;
  v_out jsonb;
begin
  select e2.metadata->>'route' into v_top
  from public.ai_usage_events e2
  where e2.occurred_at >= p_since
  group by e2.metadata->>'route'
  order by sum(e2.cost_usd) desc nulls last
  limit 1;

  select jsonb_build_object(
    'since',           p_since,
    'total_usd',       coalesce(sum(e.cost_usd), 0),
    'calls',           count(*),
    'anon_usd',        coalesce(sum(e.cost_usd) filter (where u.is_anonymous), 0),
    'anon_calls',      count(*) filter (where u.is_anonymous),
    'distinct_users',  count(distinct e.user_id),
    'distinct_anon',   count(distinct e.user_id) filter (where u.is_anonymous),
    'top_route',       v_top
  )
  into v_out
  from public.ai_usage_events e
  left join auth.users u on u.id = e.user_id
  where e.occurred_at >= p_since;

  return v_out;
end;
$$;

-- Server-role only.
revoke all on function public.ai_spend_report(timestamptz) from public;
revoke all on function public.ai_spend_report(timestamptz) from anon;
revoke all on function public.ai_spend_report(timestamptz) from authenticated;
grant execute on function public.ai_spend_report(timestamptz) to service_role;
