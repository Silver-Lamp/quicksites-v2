// lib/business/planEvidence.ts
//
// The live counts behind the business plan, read from the database at render.
//
// ⚠️ SERVER ONLY, and split out of ./verticals for a reason worth keeping: the deck is a client
// component that imports STAGE_LABEL as a value, so every import of verticals.ts is bundled for
// the browser. While the loader lived there, `supabaseAdmin` was constructed on page load in the
// browser with an undefined key and threw before a single slide rendered. Import this module
// from server components only; verticals.ts stays pure data.
import { supabaseAdmin } from '@/lib/supabase/admin';

/** Live counts, read at render. Never hardcode any of these into the prose. */
export type PlanEvidence = {
  geoCampaigns: number;
  geoPublished: number;
  geoRented: number;
  rentalPaymentsTaken: number;
  rentalCentsCollected: number;
  templates: number;
  templatesPublished: number;
  merchants: number;
  connectedMerchants: number;
  paidOrders: number;
  orderGrossCents: number;
  platformFeeCents: number;
  catalogItems: number;
  printOrders: number;
  commissionRows: number;
  orgs: number;
};

async function countOf(table: string, apply?: (q: any) => any): Promise<number> {
  try {
    let q = (supabaseAdmin as any).from(table).select('*', { count: 'exact', head: true });
    if (apply) q = apply(q);
    const { count } = await q;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function loadPlanEvidence(): Promise<PlanEvidence> {
  const [
    geoCampaigns,
    geoRented,
    templates,
    templatesPublished,
    merchants,
    catalogItems,
    printOrders,
    commissionRows,
    orgs,
  ] = await Promise.all([
    countOf('geo_industry_campaigns'),
    countOf('geo_industry_campaigns', (q) => q.not('subscription_status', 'is', null)),
    countOf('templates'),
    countOf('templates', (q) => q.eq('published', true)),
    countOf('merchants'),
    countOf('catalog_items'),
    countOf('print_orders'),
    countOf('commission_ledger'),
    countOf('organizations'),
  ]);

  let geoPublished = 0;
  let rentalPaymentsTaken = 0;
  let rentalCentsCollected = 0;
  try {
    const { data } = await (supabaseAdmin as any)
      .from('geo_industry_campaigns')
      .select('payment_count, last_payment_cents, template_id');
    for (const r of data ?? []) {
      const n = r.payment_count ?? 0;
      rentalPaymentsTaken += n;
      rentalCentsCollected += n * (r.last_payment_cents ?? 0);
    }
  } catch {
    /* evidence degrades to zero rather than guessing */
  }
  try {
    const { count } = await (supabaseAdmin as any)
      .from('templates')
      .select('*', { count: 'exact', head: true })
      .eq('published', true)
      .not('custom_domain', 'is', null);
    geoPublished = count ?? 0;
  } catch {
    /* ignore */
  }

  let paidOrders = 0;
  let orderGrossCents = 0;
  let platformFeeCents = 0;
  try {
    const { data } = await (supabaseAdmin as any)
      .from('orders')
      .select('total_cents, platform_fee_cents')
      .eq('status', 'paid');
    paidOrders = (data ?? []).length;
    for (const o of data ?? []) {
      orderGrossCents += o.total_cents ?? 0;
      platformFeeCents += o.platform_fee_cents ?? 0;
    }
  } catch {
    /* ignore */
  }

  const connectedMerchants = await countOf('payment_accounts', (q) => q.eq('status', 'active'));

  return {
    geoCampaigns,
    geoPublished,
    geoRented,
    rentalPaymentsTaken,
    rentalCentsCollected,
    templates,
    templatesPublished,
    merchants,
    connectedMerchants,
    paidOrders,
    orderGrossCents,
    platformFeeCents,
    catalogItems,
    printOrders,
    commissionRows,
    orgs,
  };
}
