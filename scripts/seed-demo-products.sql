-- Demo arts-&-crafts products for the generic storefront (catalog_items).
-- Attaches to the first merchant; idempotent on (merchant_id, slug).
-- Run: psql "$SUPABASE_DB_URL" -f scripts/seed-demo-products.sql
do $$
declare m uuid;
begin
  select id into m from merchants order by created_at limit 1;
  if m is null then raise notice 'no merchant found — nothing seeded'; return; end if;

  insert into catalog_items (merchant_id, type, title, slug, description, price_cents, status, images)
  values
    (m, 'product', 'Hand-Thrown Ceramic Mug', 'ceramic-mug',
     'Wheel-thrown stoneware mug, glazed in cobalt. Holds 12oz. Dishwasher safe.',
     3200, 'active', '["https://placehold.co/800x800?text=Ceramic+Mug"]'::jsonb),
    (m, 'product', 'Hand-Knit Wool Scarf', 'wool-scarf',
     'Chunky merino wool scarf, hand-knit. 60 inches long. Oatmeal heather.',
     5800, 'active', '["https://placehold.co/800x800?text=Wool+Scarf"]'::jsonb),
    (m, 'product', 'Letterpress Card Set (6)', 'letterpress-cards',
     'Set of 6 blank letterpress cards on cotton stock, with kraft envelopes.',
     2400, 'active', '["https://placehold.co/800x800?text=Card+Set"]'::jsonb)
  on conflict (merchant_id, slug) do nothing;

  raise notice 'seeded demo arts-&-crafts products for merchant %', m;
end $$;
