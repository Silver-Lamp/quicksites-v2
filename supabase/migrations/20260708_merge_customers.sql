-- CRM Phase 2: merge duplicate customers.
--
-- The identity spine keys customers by unique(merchant_id, email_normalized), so
-- duplicates only arise when one person buys under different emails. This RPC folds
-- a set of "loser" customer rows into a "survivor": it repoints their orders and
-- campaign receipts, additively combines the rollups (each row's counters were
-- accumulated from its own disjoint orders, so summing is exact — no double count),
-- unions tags, coalesces contact fields, concatenates notes, then deletes the losers.
--
-- Consent is deliberately NOT unioned — the survivor keeps its own marketing_consent
-- (a merge must never silently opt a customer in). Writes stay service-role-only; the
-- merchant-owner path goes through an owner-gated API route.

create or replace function public.merge_customers(
  p_merchant  uuid,
  p_survivor  uuid,
  p_losers    uuid[]
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_losers uuid[];
begin
  -- Drop the survivor from the loser set + de-dupe; ignore empties.
  select array_agg(distinct l) into v_losers
  from unnest(coalesce(p_losers, '{}'::uuid[])) as l
  where l is not null and l <> p_survivor;

  if v_losers is null or array_length(v_losers, 1) is null then
    return p_survivor;  -- nothing to merge
  end if;

  -- Every row (survivor + losers) must belong to this merchant. Refuse otherwise so a
  -- caller can't fold customers across tenants.
  if not exists (
    select 1 from public.customers where id = p_survivor and merchant_id = p_merchant
  ) then
    raise exception 'survivor % not found for merchant %', p_survivor, p_merchant;
  end if;
  if exists (
    select 1 from public.customers
    where id = any(v_losers) and (merchant_id is distinct from p_merchant)
  ) or (
    select count(*) from public.customers where id = any(v_losers)
  ) <> array_length(v_losers, 1) then
    raise exception 'one or more losers not found for merchant %', p_merchant;
  end if;

  -- Repoint orders onto the survivor.
  update public.orders
     set customer_id = p_survivor
   where customer_id = any(v_losers);

  -- Repoint campaign receipts where it wouldn't collide with the survivor's existing
  -- send for the same campaign (unique(campaign_id, customer_id)). The rest are left
  -- to fall to NULL via the FK's ON DELETE SET NULL when the loser row is removed.
  update public.crm_campaign_sends s
     set customer_id = p_survivor
   where s.customer_id = any(v_losers)
     and not exists (
       select 1 from public.crm_campaign_sends x
       where x.campaign_id = s.campaign_id and x.customer_id = p_survivor
     );

  -- Fold the rollups + annotations into the survivor. Scalar aggregates come from a
  -- flat scan of the losers (one row each) — tags are unioned in a SEPARATE subquery so
  -- expanding a jsonb array never fans out and inflates the sums.
  with agg as (
    select
      sum(orders_count)                                   as add_orders,
      sum(lifetime_cents)                                 as add_cents,
      min(first_order_at)                                 as min_first,
      max(last_order_at)                                  as max_last,
      -- first non-null contact field, most-recently-active loser first
      (array_agg(name  order by last_order_at desc nulls last) filter (where name  is not null))[1] as any_name,
      (array_agg(phone order by last_order_at desc nulls last) filter (where phone is not null))[1] as any_phone,
      (array_agg(stripe_customer_id order by last_order_at desc nulls last) filter (where stripe_customer_id is not null))[1] as any_stripe,
      string_agg(nullif(btrim(notes), ''), E'\n---\n' order by last_order_at desc nulls last) as loser_notes
    from public.customers
    where id = any(v_losers)
  )
  update public.customers cust
     set orders_count       = cust.orders_count + coalesce(agg.add_orders, 0),
         lifetime_cents     = cust.lifetime_cents + coalesce(agg.add_cents, 0),
         first_order_at     = least(cust.first_order_at, agg.min_first),
         last_order_at      = greatest(cust.last_order_at, agg.max_last),
         name               = coalesce(cust.name, agg.any_name),
         phone              = coalesce(cust.phone, agg.any_phone),
         stripe_customer_id = coalesce(cust.stripe_customer_id, agg.any_stripe),
         tags               = (
           select coalesce(jsonb_agg(distinct v), '[]'::jsonb)
           from (
             select jsonb_array_elements_text(cust.tags) as v
             union
             select jsonb_array_elements_text(c.tags)
             from public.customers c
             where c.id = any(v_losers)
           ) s
         ),
         notes              = nullif(
                                concat_ws(E'\n---\n', nullif(btrim(cust.notes), ''), agg.loser_notes),
                                ''
                              ),
         updated_at         = now()
    from agg
   where cust.id = p_survivor;

  -- Remove the folded rows.
  delete from public.customers where id = any(v_losers);

  return p_survivor;
end;
$$;

revoke all on function public.merge_customers(uuid, uuid, uuid[]) from public;
revoke all on function public.merge_customers(uuid, uuid, uuid[]) from anon;
revoke all on function public.merge_customers(uuid, uuid, uuid[]) from authenticated;
grant execute on function public.merge_customers(uuid, uuid, uuid[]) to service_role;
