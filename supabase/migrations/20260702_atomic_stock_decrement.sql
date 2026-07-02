-- Atomic inventory decrement.
--
-- Stock lives in catalog_items.metadata (item-level `stock`, or per-variant
-- `stock` inside the `variants` array). The app used to decrement with a
-- read-modify-write in markOrderPaid, which two concurrent paid orders could race
-- — both read stock=1 and both write 0, overselling. This function does the whole
-- read-check-decrement under a row lock (`for update`), so concurrent calls
-- serialize and the guard is authoritative: the second racer sees the updated
-- stock and fails instead of driving the count past what exists.
--
-- Returns jsonb { ok, remaining, reason? }:
--   ok=true,  remaining=null  → untracked (unlimited) or nothing to do
--   ok=true,  remaining=N     → decremented; N left
--   ok=false, reason=insufficient, remaining=N → not enough stock (no change)
--   ok=false, reason=not_found → no such catalog item
--
-- Untracked stock (no numeric `stock` key) is always ok — unlimited.
create or replace function public.decrement_catalog_stock(p_item uuid, p_variant text, p_qty int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb;
  v_variants jsonb;
  v_idx int := null;
  v_elem jsonb;
  v_stock int;
begin
  if p_qty is null or p_qty <= 0 then
    return jsonb_build_object('ok', true, 'remaining', null);
  end if;

  -- Lock the row for the life of this call; concurrent decrements queue here.
  select metadata into v_meta from public.catalog_items where id = p_item for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if p_variant is not null and p_variant <> '' then
    v_variants := coalesce(v_meta->'variants', '[]'::jsonb);
    for i in 0 .. coalesce(jsonb_array_length(v_variants), 0) - 1 loop
      if v_variants->i->>'id' = p_variant then
        v_idx := i;
        v_elem := v_variants->i;
        exit;
      end if;
    end loop;

    -- Variant absent, or its stock isn't a tracked number → untracked. Use
    -- `is distinct from` so an absent stock key (jsonb_typeof → NULL) is handled.
    if v_idx is null or jsonb_typeof(v_elem->'stock') is distinct from 'number' then
      return jsonb_build_object('ok', true, 'remaining', null);
    end if;

    v_stock := (v_elem->>'stock')::int;
    if v_stock < p_qty then
      return jsonb_build_object('ok', false, 'reason', 'insufficient', 'remaining', v_stock);
    end if;

    update public.catalog_items
      set metadata = jsonb_set(v_meta, array['variants', v_idx::text, 'stock'], to_jsonb(v_stock - p_qty))
      where id = p_item;
    return jsonb_build_object('ok', true, 'remaining', v_stock - p_qty);
  end if;

  -- Item-level stock (plain product). `is distinct from` handles an absent key.
  if jsonb_typeof(v_meta->'stock') is distinct from 'number' then
    return jsonb_build_object('ok', true, 'remaining', null);
  end if;
  v_stock := (v_meta->>'stock')::int;
  if v_stock < p_qty then
    return jsonb_build_object('ok', false, 'reason', 'insufficient', 'remaining', v_stock);
  end if;

  update public.catalog_items
    set metadata = jsonb_set(v_meta, '{stock}', to_jsonb(v_stock - p_qty))
    where id = p_item;
  return jsonb_build_object('ok', true, 'remaining', v_stock - p_qty);
end;
$$;

-- Server-role only: never let a browser/anon token decrement stock directly
-- (that would be a denial-of-inventory grief vector). Supabase's default
-- privileges auto-grant EXECUTE on new public functions to anon/authenticated, so
-- revoking from PUBLIC alone is NOT enough — revoke those roles explicitly.
revoke all on function public.decrement_catalog_stock(uuid, text, int) from public;
revoke all on function public.decrement_catalog_stock(uuid, text, int) from anon;
revoke all on function public.decrement_catalog_stock(uuid, text, int) from authenticated;
grant execute on function public.decrement_catalog_stock(uuid, text, int) to service_role;
