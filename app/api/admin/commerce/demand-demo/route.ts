import { NextRequest, NextResponse } from 'next/server';
import { createDraftOrder, markOrderPaid } from '@/lib/commerce/orders';
import { authorizeCheckoutItems } from '@/lib/commerce/checkoutItems';
import { buildCatalogRowsFromMenu } from '@/lib/commerce/menuCatalog';
import { getServerSupabase } from '@/lib/supabase/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { recordDemandEvent, getDemandDetails, getDemandCount } from '@/lib/menu/demand';
import { hasMenuBlock, resolveMerchantFeeDefault } from '@/lib/commerce/pricingPolicy';
import { resolveListingPhone } from '@/lib/claim/resolveListingPhone';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Green-path proof for the FULL no-website demand-capture funnel (companion to
 * /api/admin/commerce/menu-demo, which proves the menu→order money path). No real
 * Stripe, no Twilio. Forces every seam of the funnel to connect end-to-end:
 *
 *   seed a listing_import draft (menu block + listing phone)
 *   -> recordDemandEvent x3 (2 order-ahead leads + 1 tap-to-call)      [demand]
 *   -> getDemandCount/Details reflect the escalated claim state         [claim pitch]
 *   -> resolveListingPhone finds the number (the Phase-2 SMS precondition)
 *   -> claim_operator_draft transfers ownership + flips claim_source    [claim]
 *   -> getDemandDetails still returns the leads (what /welcome shows)    [payoff]
 *   -> resolveMerchantFeeDefault → restaurant terms (8% + 60¢)          [pricing]
 *   -> seed catalog from the menu, run two orders through the real path:
 *        $5 order  → fee 60¢  (8%×$5=40¢ < 60¢ floor → the floor bites)
 *        $30 order → fee 240¢ (8%×$30 → the percent bites)
 *
 * Admin-gated, idempotent seed, POST {cleanup:true} tears it down.
 * Loosely typed on purpose (types/supabase.ts is stale for commerce — CLAUDE.md §8).
 */

const DEMO_SLUG = 'demand-demo-restaurant';
const DEMO_NAME = 'Demand Demo Diner';
const DEMO_PHONE = '+12065550100';

function draftData() {
  return {
    color_mode: 'dark',
    pages: [
      {
        slug: 'home',
        blocks: [
          {
            type: 'menu',
            content: {
              sections: [
                { name: 'Menu', items: [
                  { name: 'Side Salad', description: 'Greens.', price_cents: 500 },
                  { name: 'Family Feast', description: 'Feeds four.', price_cents: 3000 },
                ] },
              ],
            },
          },
          { type: 'contact', content: { phone: DEMO_PHONE } },
        ],
      },
    ],
    meta: { industry: 'restaurant', business_name: DEMO_NAME },
  };
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = await getServerSupabase({ serviceRole: true });
  const body = await req.json().catch(() => ({}));
  const cleanup = body.cleanup === true;

  const { data: tplRow } = await db.from('templates').select('id').eq('slug', DEMO_SLUG).maybeSingle();
  let templateId: string | undefined = tplRow?.id;
  const { data: mRow } = await db.from('merchants').select('id').eq('site_slug', DEMO_SLUG).maybeSingle();
  let merchantId: string | undefined = mRow?.id;

  if (cleanup) {
    if (merchantId) {
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
    }
    if (templateId) {
      await db.from('demand_events').delete().eq('template_id', templateId);
      await db.from('templates').delete().eq('id', templateId);
    }
    return NextResponse.json({ cleaned: true, merchantId, templateId });
  }

  // --- 1. Seed the outreach draft (reset each run for determinism) ---
  const data = draftData();
  if (templateId) {
    await db.from('demand_events').delete().eq('template_id', templateId);
    await db.from('templates').delete().eq('id', templateId); // INSERT/DELETE ok; UPDATE is trigger-guarded
  }
  const { data: t, error: tErr } = await db
    .from('templates')
    .insert({ template_name: DEMO_NAME, slug: DEMO_SLUG, claim_source: 'listing_import', owner_id: null, business_name: DEMO_NAME, data })
    .select('id, claim_source')
    .single();
  if (tErr || !t) return NextResponse.json({ step: 'seed_draft', error: tErr?.message }, { status: 500 });
  templateId = t.id as string;
  const seededAsListing = t.claim_source === 'listing_import';

  // --- 2. Log demand through the real lib (must be a listing_import draft) ---
  await recordDemandEvent({ templateId, kind: 'order_ahead', contactName: 'Ada', contactPhone: '+12065550111', items: 'margherita x2' });
  await recordDemandEvent({ templateId, kind: 'order_ahead', contactName: 'Ben', contactPhone: '+12065550122', items: 'calzone' });
  await recordDemandEvent({ templateId, kind: 'call' });
  const demand = (await getDemandDetails([templateId]))[templateId];
  const pitchCount = await getDemandCount(templateId);

  // --- 3/4. Claim pitch data + the Phase-2 phone precondition ---
  const isMenu = hasMenuBlock(data);
  const listingPhone = resolveListingPhone({ data });

  // --- 5. Claim: transfer ownership operator → owner (here, the admin) ---
  await db.rpc('claim_operator_draft', { p_template_id: templateId, p_to_owner: admin.id });
  const { data: afterClaim } = await db.from('templates').select('owner_id, claim_source').eq('id', templateId).single();
  const claimedOk = afterClaim?.owner_id === admin.id && afterClaim?.claim_source !== 'listing_import';

  // --- 6. Post-claim payoff — the leads /welcome shows the new owner ---
  const payoff = (await getDemandDetails([templateId]))[templateId];

  // --- 7. Onboard @ the resolved restaurant terms ---
  if (!merchantId) {
    const { data: m, error } = await db
      .from('merchants')
      .insert({ user_id: admin.id, name: DEMO_NAME, site_slug: DEMO_SLUG, provider: 'custom', default_currency: 'USD', is_public: false })
      .select('id')
      .single();
    if (error || !m) return NextResponse.json({ step: 'create_merchant', error: error?.message }, { status: 500 });
    merchantId = m.id as string;
  }
  const fee = await resolveMerchantFeeDefault(merchantId); // keys off the site's menu block
  const acctFields = {
    provider: 'custom', account_ref: 'demand-demo', status: 'active',
    collect_platform_fee: fee.collect, platform_fee_percent: fee.percent, platform_fee_min_cents: fee.minCents,
  };
  const { data: acct } = await db.from('payment_accounts').select('id').eq('merchant_id', merchantId).maybeSingle();
  if (acct?.id) await db.from('payment_accounts').update(acctFields).eq('id', acct.id);
  else {
    const { error } = await db.from('payment_accounts').insert({ merchant_id: merchantId, ...acctFields });
    if (error) return NextResponse.json({ step: 'payment_account', error: error.message }, { status: 500 });
  }

  // --- 8. Money path: catalog from the menu → two orders (floor + percent) ---
  const rows = buildCatalogRowsFromMenu(data.pages[0].blocks[0].content.sections as any);
  await db.from('catalog_items').delete().eq('merchant_id', merchantId);
  const itemIdByName: Record<string, string> = {};
  for (const r of rows) {
    const { data: item, error } = await db
      .from('catalog_items')
      .insert({ merchant_id: merchantId, type: 'meal', title: r.name, slug: r.slug, description: r.description || null, price_cents: r.price_cents, status: 'active', images: [], metadata: { site_slug: DEMO_SLUG, category: r.section } })
      .select('id')
      .single();
    if (error || !item) return NextResponse.json({ step: 'create_item', item: r.name, error: error?.message }, { status: 500 });
    itemIdByName[r.name] = item.id as string;
  }

  const smallId = itemIdByName['Side Salad'];   // $5
  const bigId = itemIdByName['Family Feast'];    // $30
  const { data: catalogRows } = await db
    .from('catalog_items')
    .select('id, merchant_id, title, price_cents, status, metadata')
    .in('id', [smallId, bigId]);

  async function placeOrder(catalogItemId: string) {
    const priced = authorizeCheckoutItems({ merchantId: merchantId!, requested: [{ catalogItemId, quantity: 1 }], catalogRows: (catalogRows ?? []) as any });
    if (!priced.ok) return { error: priced.error };
    const { orderId, totalCents } = await createDraftOrder({ merchantId: merchantId!, siteSlug: DEMO_SLUG, currency: 'USD', items: priced.items });
    await markOrderPaid(orderId, totalCents, 'test', `test_${orderId}`, { test: true, source: 'demand-demo' });
    const { data: o } = await db.from('orders').select('status, total_cents, platform_fee_cents').eq('id', orderId).single();
    return { orderId, order: o };
  }
  const small = await placeOrder(smallId);   // subtotal 500 → fee max(40,60)=60
  const big = await placeOrder(bigId);       // subtotal 3000 → fee max(240,60)=240

  // --- Assertions ---
  const checks = [
    { name: 'draft seeded as listing_import', ok: seededAsListing },
    { name: 'demand logged (3 events: 2 leads + 1 call)', ok: demand?.count === 3 && demand?.leads.length === 2 && demand?.calls === 1, got: demand && { count: demand.count, leads: demand.leads.length, calls: demand.calls } },
    { name: 'claim pitch count = 3', ok: pitchCount === 3, got: pitchCount },
    { name: 'menu-ordering site detected (drives restaurant pricing + the pitch)', ok: isMenu === true },
    { name: 'listing phone resolved (Phase-2 SMS precondition)', ok: listingPhone === DEMO_PHONE, got: listingPhone },
    { name: 'claim transferred ownership + flipped claim_source', ok: claimedOk, got: afterClaim },
    { name: 'payoff: 2 leads readable post-claim (what /welcome shows)', ok: (payoff?.leads.length ?? 0) === 2, got: payoff?.leads?.length },
    { name: 'onboarding resolved restaurant terms: 8% + 60¢', ok: fee.percent === 0.08 && fee.minCents === 60 && fee.collect === true, got: fee },
    { name: '$5 order fee = 60¢ (floor bites: 8%×$5=40¢ < 60¢)', ok: small.order?.platform_fee_cents === 60, got: small.order?.platform_fee_cents },
    { name: '$30 order fee = 240¢ (percent bites: 8%×$30)', ok: big.order?.platform_fee_cents === 240, got: big.order?.platform_fee_cents },
  ];
  const ok = checks.every((c) => c.ok);

  return NextResponse.json({
    ok,
    summary: 'Full funnel: listing_import draft → 3 order-intents → claim (ownership transfer) → payoff leads → onboard @ 8%+60¢ → $5 order fee 60¢ (floor) + $30 order fee 240¢ (percent).',
    templateId,
    merchantId,
    demand: demand && { count: demand.count, leads: demand.leads.length, calls: demand.calls },
    resolvedFee: fee,
    orders: { small: small.order, big: big.order },
    checks,
    cleanupHint: 'POST {"cleanup":true} to remove the demo template, merchant, and their rows.',
  });
}
