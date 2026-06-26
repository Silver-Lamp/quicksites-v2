-- Checkout scaffold: orders.site_slug
-- createDraftOrder (open_commerce) writes orders.site_slug, but the live table
-- only had site_id. Add it (nullable, additive) so the order path works.
alter table orders add column if not exists site_slug text;
