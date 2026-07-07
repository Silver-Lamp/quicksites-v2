-- Backorder-aware inventory decrement (INVENTORY_PLAN.md Phase 1, item 4).
--
-- Extends decrement_catalog_stock with two policy signals read from the item's
-- metadata (item-level, applies to its variants too):
--   • track_inventory = false  → the item is untracked (unlimited); never decrement.
--   • inventory_policy = 'continue' → backorder: sell past zero (stock may go negative,
--     mirroring Shopify's "continue selling when out of stock"). Default 'deny' keeps
--     the original block-on-insufficient behavior.
--
-- Same row-lock (`for update`) as before, so concurrent orders still serialize. Return
-- shape is unchanged: { ok, remaining, reason? }.
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
  v_continue boolean;
begin
  if p_qty is null or p_qty <= 0 then
    return jsonb_build_object('ok', true, 'remaining', null);
  end if;

  select metadata into v_meta from public.catalog_items where id = p_item for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- Explicitly-untracked item → unlimited, nothing to decrement.
  if v_meta->>'track_inventory' = 'false' then
    return jsonb_build_object('ok', true, 'remaining', null);
  end if;

  v_continue := coalesce(v_meta->>'inventory_policy', 'deny') = 'continue';

  if p_variant is not null and p_variant <> '' then
    v_variants := coalesce(v_meta->'variants', '[]'::jsonb);
    for i in 0 .. coalesce(jsonb_array_length(v_variants), 0) - 1 loop
      if v_variants->i->>'id' = p_variant then
        v_idx := i;
        v_elem := v_variants->i;
        exit;
      end if;
    end loop;

    if v_idx is null or jsonb_typeof(v_elem->'stock') is distinct from 'number' then
      return jsonb_build_object('ok', true, 'remaining', null);
    end if;

    v_stock := (v_elem->>'stock')::int;
    if not v_continue and v_stock < p_qty then
      return jsonb_build_object('ok', false, 'reason', 'insufficient', 'remaining', v_stock);
    end if;

    update public.catalog_items
      set metadata = jsonb_set(v_meta, array['variants', v_idx::text, 'stock'], to_jsonb(v_stock - p_qty))
      where id = p_item;
    return jsonb_build_object('ok', true, 'remaining', v_stock - p_qty);
  end if;

  if jsonb_typeof(v_meta->'stock') is distinct from 'number' then
    return jsonb_build_object('ok', true, 'remaining', null);
  end if;
  v_stock := (v_meta->>'stock')::int;
  if not v_continue and v_stock < p_qty then
    return jsonb_build_object('ok', false, 'reason', 'insufficient', 'remaining', v_stock);
  end if;

  update public.catalog_items
    set metadata = jsonb_set(v_meta, '{stock}', to_jsonb(v_stock - p_qty))
    where id = p_item;
  return jsonb_build_object('ok', true, 'remaining', v_stock - p_qty);
end;
$$;

revoke all on function public.decrement_catalog_stock(uuid, text, int) from public;
revoke all on function public.decrement_catalog_stock(uuid, text, int) from anon;
revoke all on function public.decrement_catalog_stock(uuid, text, int) from authenticated;
grant execute on function public.decrement_catalog_stock(uuid, text, int) to service_role;
