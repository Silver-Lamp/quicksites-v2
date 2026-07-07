-- Atomic inventory increment (restock).
--
-- The mirror of decrement_catalog_stock: adds units back to a catalog item's tracked
-- stock under a row lock. Used to restock on refund (INVENTORY_PLAN.md Phase 1, gated
-- by QS_RESTOCK_ON_REFUND). Only touches TRACKED stock — an untracked item (no numeric
-- `stock`, or a variant whose stock isn't a number) is left unlimited (no-op), so a
-- refund can never accidentally start "tracking" a previously-untracked product.
--
-- Returns jsonb { ok, remaining }:
--   ok=true, remaining=null → untracked (nothing to do) or item/variant not found
--   ok=true, remaining=N    → incremented; N now on hand
create or replace function public.increment_catalog_stock(p_item uuid, p_variant text, p_qty int)
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

  select metadata into v_meta from public.catalog_items where id = p_item for update;
  if not found then
    return jsonb_build_object('ok', true, 'remaining', null);
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

    -- Only restock a variant that is actually tracked.
    if v_idx is null or jsonb_typeof(v_elem->'stock') is distinct from 'number' then
      return jsonb_build_object('ok', true, 'remaining', null);
    end if;

    v_stock := (v_elem->>'stock')::int;
    update public.catalog_items
      set metadata = jsonb_set(v_meta, array['variants', v_idx::text, 'stock'], to_jsonb(v_stock + p_qty))
      where id = p_item;
    return jsonb_build_object('ok', true, 'remaining', v_stock + p_qty);
  end if;

  -- Item-level stock (plain product); only when tracked.
  if jsonb_typeof(v_meta->'stock') is distinct from 'number' then
    return jsonb_build_object('ok', true, 'remaining', null);
  end if;
  v_stock := (v_meta->>'stock')::int;
  update public.catalog_items
    set metadata = jsonb_set(v_meta, '{stock}', to_jsonb(v_stock + p_qty))
    where id = p_item;
  return jsonb_build_object('ok', true, 'remaining', v_stock + p_qty);
end;
$$;

-- Service-role only (same posture as decrement).
revoke all on function public.increment_catalog_stock(uuid, text, int) from public;
revoke all on function public.increment_catalog_stock(uuid, text, int) from anon;
revoke all on function public.increment_catalog_stock(uuid, text, int) from authenticated;
grant execute on function public.increment_catalog_stock(uuid, text, int) to service_role;
