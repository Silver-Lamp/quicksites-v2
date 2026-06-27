-- Remove the meal-coupled reviews subsystem's table.
-- All review API routes + the reviews_list block were removed; nothing reads it.
-- Generic product reviews can be rebuilt on catalog_items/orders when needed.
drop table if exists reviews;
