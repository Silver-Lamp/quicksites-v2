-- Surface oversold orders for merchant reconciliation.
--
-- When a paid order can't be fully drawn down from stock (a race won by another
-- order — see decrement_catalog_stock), markOrderPaid records the shortfall here
-- so the merchant can act (refund / backorder) instead of only a server log.
-- Null = fine. Shape: [{ title, variant_label, requested, remaining }].
alter table public.orders add column if not exists oversold_lines jsonb;
