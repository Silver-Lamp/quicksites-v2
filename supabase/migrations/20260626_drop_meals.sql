-- Final delivered.menu teardown: drop the meals table + its review-leftover FK
-- dependents, and decouple orders from meals.
-- All meal/review code paths are removed or obsolete; the commerce path uses
-- catalog_items / order_items.catalog_item_id.
drop table if exists review_invites;
drop table if exists review_tokens;
alter table order_items drop column if exists meal_id;
drop table if exists meals;
