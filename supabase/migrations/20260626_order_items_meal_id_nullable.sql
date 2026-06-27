-- Checkout scaffold: order_items.meal_id was NOT NULL (chef vertical). The generic
-- path uses catalog_item_id, so meal_id must be nullable.
alter table order_items alter column meal_id drop not null;
