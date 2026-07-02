-- Reserve-then-confirm inventory.
--
-- Overselling is already prevented at paid-time (decrement_catalog_stock), but a
-- buyer could still pay for a unit that sold out during their checkout and get a
-- refund. Reservations move the decrement EARLIER — to draft/checkout time — so
-- stock is held the moment an order is placed and the buyer is told "sold out"
-- BEFORE paying. Abandoned holds are released by a sweep (cron) after they expire.
--
-- Model: reserve = atomic decrement (reusing decrement_catalog_stock) + a
-- stock_reservations row we can later consume (on payment) or release (on
-- abandon/expiry/failed checkout, adding the units back).

create table if not exists public.stock_reservations (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null,
  catalog_item_id uuid not null,
  variant_id      text,                     -- null = item-level stock
  quantity        int  not null check (quantity > 0),
  status          text not null default 'held' check (status in ('held','consumed','released')),
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now()
);
create index if not exists stock_reservations_order_idx on public.stock_reservations(order_id);
create index if not exists stock_reservations_sweep_idx on public.stock_reservations(status, expires_at);

-- Deny-default: server-role only (the app reserves/releases via service role).
alter table public.stock_reservations enable row level security;

-- Reserve one line: atomic decrement, then record the hold (only when the stock
-- is actually tracked — untracked/unlimited lines need no reservation).
create or replace function public.reserve_catalog_stock(p_order uuid, p_item uuid, p_variant text, p_qty int, p_ttl_minutes int default 30)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_res jsonb;
begin
  v_res := public.decrement_catalog_stock(p_item, p_variant, p_qty);
  if coalesce((v_res->>'ok')::boolean, false) is not true then
    return v_res; -- insufficient / not_found: nothing held
  end if;
  if v_res->>'remaining' is not null then
    insert into public.stock_reservations(order_id, catalog_item_id, variant_id, quantity, expires_at)
    values (p_order, p_item, nullif(p_variant, ''), p_qty, now() + make_interval(mins => greatest(1, coalesce(p_ttl_minutes, 30))));
  end if;
  return v_res;
end;
$$;

-- Release all held reservations for an order, adding the units back atomically.
create or replace function public.release_order_reservations(p_order uuid)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  r record; v_meta jsonb; v_variants jsonb; v_idx int; v_stock int; n int := 0;
begin
  for r in select * from public.stock_reservations where order_id = p_order and status = 'held' for update loop
    select metadata into v_meta from public.catalog_items where id = r.catalog_item_id for update;
    if found then
      if r.variant_id is not null then
        v_variants := coalesce(v_meta->'variants', '[]'::jsonb);
        v_idx := null;
        for i in 0 .. coalesce(jsonb_array_length(v_variants), 0) - 1 loop
          if v_variants->i->>'id' = r.variant_id then v_idx := i; exit; end if;
        end loop;
        if v_idx is not null and jsonb_typeof(v_variants->v_idx->'stock') = 'number' then
          v_stock := (v_variants->v_idx->>'stock')::int;
          update public.catalog_items
            set metadata = jsonb_set(v_meta, array['variants', v_idx::text, 'stock'], to_jsonb(v_stock + r.quantity))
            where id = r.catalog_item_id;
        end if;
      elsif jsonb_typeof(v_meta->'stock') = 'number' then
        v_stock := (v_meta->>'stock')::int;
        update public.catalog_items
          set metadata = jsonb_set(v_meta, '{stock}', to_jsonb(v_stock + r.quantity))
          where id = r.catalog_item_id;
      end if;
    end if;
    update public.stock_reservations set status = 'released' where id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Confirm an order's holds on payment: the stock was already decremented at
-- reserve time, so we just mark them consumed (no stock change).
create or replace function public.consume_order_reservations(p_order uuid)
returns int
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  update public.stock_reservations set status = 'consumed' where order_id = p_order and status = 'held';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Sweep expired holds (abandoned checkouts) back into stock. Cron-driven.
create or replace function public.sweep_expired_reservations()
returns int
language plpgsql security definer set search_path = public
as $$
declare r record; n int := 0;
begin
  for r in select distinct order_id from public.stock_reservations where status = 'held' and expires_at < now() loop
    n := n + public.release_order_reservations(r.order_id);
  end loop;
  return n;
end;
$$;

-- Server-role only for every reservation function (never anon/authenticated).
do $$
declare fn text;
begin
  foreach fn in array array[
    'reserve_catalog_stock(uuid, uuid, text, integer, integer)',
    'release_order_reservations(uuid)',
    'consume_order_reservations(uuid)',
    'sweep_expired_reservations()'
  ] loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('revoke all on function public.%s from anon', fn);
    execute format('revoke all on function public.%s from authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end $$;
