-- Retire the legacy `products` table.
-- All product management (admin tooling + storefront + orders) now uses the
-- canonical `catalog_items` (open_commerce). The legacy `products` table held
-- only fake/test rows and is referenced by no code, FK, or view.
drop table if exists products;
