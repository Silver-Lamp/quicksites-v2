import { NextRequest, NextResponse } from 'next/server';
import { createDraftOrder, markOrderPaid } from '@/lib/commerce/orders';
import { authorizeCheckoutItems } from '@/lib/commerce/checkoutItems';
import { buildCatalogRowsFromMenu } from '@/lib/commerce/menuCatalog';
import { normalizeVariants } from '@/lib/commerce/variants';
import { getServerSupabase } from '@/lib/supabase/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Green-path proof for the RESTAURANT menu → ordering chain (companion to
 * /api/admin/commerce/e2e-demo, which proves the generic money path). This one
 * exercises the pieces unique to the menu vertical, end-to-end, no real Stripe:
 *
 *   a menu (a plain item + a "choose one" item with Small/Large options)
 *   -> buildCatalogRowsFromMenu + normalizeVariants   (the publish-catalog logic)
 *   -> insert catalog_items (base price = cheapest option; variants in metadata)
 *   -> authorizeCheckoutItems on the plain item + the *Large* variant
 *      (asserts the variant reprices to $12, NOT the $8 base)
 *   -> createDraftOrder -> markOrderPaid
 *   -> assert the platform fee is taken on the real (variant) prices.
 *
 * Admin-gated, idempotent seed, POST {cleanup:true} tears it down.
 * Loosely typed on purpose (types/supabase.ts is stale for commerce — CLAUDE.md §8).
 */

const DEMO_SLUG = 'menu-demo-merchant';

export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = await getServerSupabase({ serviceRole: true });

  const body = await req.json().catch(() => ({}));
  const feePercent = Number.isFinite(body.feePercent) ? Math.max(0, Math.min(0.1, body.feePercent)) : 0.08;
  const cleanup = body.cleanup === true;

  const { data: existing } = await db.from('merchants').select('id').eq('site_slug', DEMO_SLUG).maybeSingle();
  let merchantId: string | undefined = existing?.id;

  if (cleanup) {
    if (!merchantId) return NextResponse.json({ cleaned: true, note: 'no demo merchant existed' });
    const { data: orderIds } = await db.from('orders').select('id').eq('merchant_id', merchantId);
    const ids = (orderIds ?? []).map((o: any) => o.id);
    if (ids.length) {
      await db.from('payments').delete().in('order_id', ids);
      await db.from('order_items').delete().in('order_id', ids);
      await db.from('commission_ledger').delete().in('subject_id', ids);
    }
    await db.from('orders').delete().eq('merchant_id', merchantId);
    await db.from('catalog_items').delete().eq('merchant_id', merchantId);
    await db.from('payment_accounts').delete().eq('merchant_id', merchantId);
    await db.from('merchants').delete().eq('id', merchantId);
    return NextResponse.json({ cleaned: true, merchantId });
  }

  // --- Demo merchant + active take-rate account ---
  if (!merchantId) {
    const { data: m, error } = await db
      .from('merchants')
      .insert({ user_id: admin.id, name: 'Menu Demo Cafe', site_slug: DEMO_SLUG, provider: 'custom', default_currency: 'USD', is_public: false })
      .select('id')
      .single();
    if (error) return NextResponse.json({ step: 'create_merchant', error: error.message }, { status: 500 });
    merchantId = m.id;
  }
  if (!merchantId) return NextResponse.json({ step: 'resolve_merchant', error: 'no merchant id' }, { status: 500 });

  const acctFields = {
    provider: 'custom',
    account_ref: 'menu-demo',
    status: 'active',
    collect_platform_fee: true,
    platform_fee_percent: feePercent,
    platform_fee_min_cents: 0,
  };
  const { data: acct } = await db.from('payment_accounts').select('id').eq('merchant_id', merchantId).maybeSingle();
  if (acct?.id) await db.from('payment_accounts').update(acctFields).eq('id', acct.id);
  else {
    const { error } = await db.from('payment_accounts').insert({ merchant_id: merchantId, ...acctFields });
    if (error) return NextResponse.json({ step: 'payment_account', error: error.message }, { status: 500 });
  }

  // --- The menu (plain item + a choose-one item) → catalog via the real helpers ---
  const menuSections = [
    { name: 'Lunch', items: [{ name: 'House Salad', description: 'Greens.', price_cents: 900 }] },
    {
      name: 'Shareables',
      items: [{ name: 'Wings', options: [{ label: 'Small', price_cents: 800 }, { label: 'Large', price_cents: 1200 }] }],
    },
  ];
  const rows = buildCatalogRowsFromMenu(menuSections);

  // Reset any prior demo catalog so the run is deterministic.
  await db.from('catalog_items').delete().eq('merchant_id', merchantId);

  const created: Record<string, { id: string; largeVariantId?: string }> = {};
  for (const r of rows) {
    const norm = r.variants?.length
      ? normalizeVariants({ variants: r.variants.map((v) => ({ label: v.label, priceCents: v.price_cents })), fallbackBaseCents: r.price_cents })
      : null;
    const metadata: Record<string, any> = { site_slug: DEMO_SLUG, category: r.section };
    if (norm) { metadata.variants = norm.variants; metadata.variant_options = norm.variant_options; }
    const { data: item, error } = await db
      .from('catalog_items')
      .insert({ merchant_id: merchantId, type: 'meal', title: r.name, slug: r.slug, description: r.description || null, price_cents: norm ? norm.basePriceCents : r.price_cents, status: 'active', images: [], metadata })
      .select('id')
      .single();
    if (error || !item) return NextResponse.json({ step: 'create_item', item: r.name, error: error?.message }, { status: 500 });
    created[r.name] = { id: item.id, largeVariantId: norm?.variants.find((v) => v.label === 'Large')?.id };
  }

  const salad = created['House Salad'];
  const wings = created['Wings'];

  // --- Order the salad + the LARGE wings variant through the real checkout auth ---
  const requested = [
    { catalogItemId: salad.id, quantity: 1 },
    { catalogItemId: wings.id, variantId: wings.largeVariantId, quantity: 1 },
  ];
  const { data: catalogRows } = await db
    .from('catalog_items')
    .select('id, merchant_id, title, price_cents, status, metadata')
    .in('id', [salad.id, wings.id]);

  const priced = authorizeCheckoutItems({ merchantId, requested, catalogRows: (catalogRows ?? []) as any });
  if (!priced.ok) return NextResponse.json({ step: 'authorize', error: priced.error, badItemId: priced.badItemId }, { status: 400 });

  const wingsLine = priced.items.find((i) => i.catalogItemId === wings.id);
  const saladLine = priced.items.find((i) => i.catalogItemId === salad.id);

  const { orderId, totalCents } = await createDraftOrder({ merchantId, siteSlug: DEMO_SLUG, currency: 'USD', items: priced.items });
  await markOrderPaid(orderId, totalCents, 'test', `test_${orderId}`, { test: true, source: 'menu-demo' });

  const { data: order } = await db.from('orders').select('status, total_cents, platform_fee_cents').eq('id', orderId).single();

  // --- Assertions ---
  const expectedSubtotal = 900 + 1200; // salad + LARGE wings (base is 800; proves reprice)
  const expectedFee = Math.floor(expectedSubtotal * feePercent);
  const wingsBaseItem = (catalogRows ?? []).find((c: any) => c.id === wings.id);

  const checks = [
    { name: 'both menu items created', ok: !!salad?.id && !!wings?.id },
    { name: 'wings base price = cheapest option ($8)', ok: wingsBaseItem?.price_cents === 800, got: wingsBaseItem?.price_cents, expected: 800 },
    { name: 'checkout repriced the LARGE variant to $12 (not the $8 base)', ok: wingsLine?.unitAmount === 1200, got: wingsLine?.unitAmount, expected: 1200 },
    { name: 'plain item priced at $9', ok: saladLine?.unitAmount === 900, got: saladLine?.unitAmount, expected: 900 },
    { name: 'order marked paid', ok: order?.status === 'paid', got: order?.status },
    { name: 'platform fee taken on the real variant prices', ok: order?.platform_fee_cents === expectedFee, got: order?.platform_fee_cents, expected: expectedFee },
  ];
  const ok = checks.every((c) => c.ok);

  const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
  return NextResponse.json({
    ok,
    summary: `Menu → 2 products (Wings base ${fmt(800)}, Large ${fmt(1200)}). Ordered salad + Large wings = ${fmt(expectedSubtotal)}; platform fee at ${(feePercent * 100).toFixed(1)}% = ${fmt(expectedFee)}.`,
    merchantId,
    orderId,
    itemsCreated: rows.length,
    subtotal_cents: expectedSubtotal,
    platform_fee_cents: order?.platform_fee_cents,
    checks,
    cleanupHint: 'POST {"cleanup":true} to remove the demo merchant and its rows.',
  });
}
