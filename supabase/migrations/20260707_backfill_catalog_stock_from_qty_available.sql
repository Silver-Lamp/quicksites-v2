-- 20260707_backfill_catalog_stock_from_qty_available.sql
--
-- Inventory field unification (INVENTORY_PLAN.md Phase 1).
--
-- Checkout + the decrement RPC enforce `catalog_items.metadata.stock`, but the admin
-- product tools historically wrote an un-enforced `metadata.qty_available`, so
-- admin-managed stock was silently ignored at checkout. The admin API now writes
-- `metadata.stock`; this backfills existing rows so their stock becomes enforced.
--
-- Safe + idempotent: only plain (variant-less) rows that HAVE a numeric qty_available
-- and do NOT already have a stock value are touched — never overwrites an enforced
-- value, and re-running is a no-op. `qty_available` is left in place (inert; the admin
-- compat read prefers `stock`) rather than deleted, to avoid any data loss here.

update public.catalog_items
set
  metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{stock}', metadata -> 'qty_available', true),
  updated_at = now()
where metadata ? 'qty_available'
  and not (metadata ? 'stock')
  and not (metadata ? 'variants')
  and jsonb_typeof(metadata -> 'qty_available') = 'number';
