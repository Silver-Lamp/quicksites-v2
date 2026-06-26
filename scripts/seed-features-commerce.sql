-- Re-orient the /features showcase: remove the job-hunt portfolio entries and add
-- the builder + commerce + reseller product features. Idempotent.
do $$
declare oid uuid;
begin
  -- Remove unrelated portfolio / showcase entries
  delete from features where title in (
    'Hive Journal', 'Global Wellness', 'Lovio', 'Delivered Menu',
    'A neighborhood marketplace for meals, goods, and services', 'QuickSites AI'
  );

  select org_id into oid from features order by created_at limit 1;
  if oid is null then raise notice 'no org_id found; skipping inserts'; return; end if;

  insert into features (org_id, title, blurb, category, slug, featured, feature_order, badge, is_public, is_archived)
  values
    (oid, 'E-commerce storefront',
     'A product catalog and checkout on every site — products, services, or digital goods — with a cart and Stripe-powered payments out of the box.',
     'E-Commerce', 'ecommerce-storefront', true, 1, 'New', true, false),
    (oid, 'Platform fees & payouts',
     'Collect a percentage of every order via Stripe Connect — your take-rate, set per merchant — with automatic refund and fee-reversal handling.',
     'E-Commerce', 'platform-fees-payouts', true, 2, null, true, false),
    (oid, 'White-label reseller program',
     'Bring the builder + commerce to your network under your own brand. Onboard merchants through whitelisted payment processors and earn per-order plus residual commissions.',
     'Brand', 'white-label-reseller', true, 3, null, true, false),
    (oid, 'Revenue dashboard',
     'Reconcile GMV, platform fees collected, refunds, and partner commissions in one place.',
     'E-Commerce', 'revenue-dashboard', false, 4, null, true, false)
  on conflict (org_id, title) do nothing;
end $$;
