// lib/menu/demandFunnel.ts
//
// The kickoff cockpit: the no-website funnel as stages with counts, from imported drafts
// down to fees collected. One server-side loader over the demand + commerce tables, so the
// operator can watch a cohort convert in one place. Outreach drafts are claim_source
// 'listing_import' (unclaimed) → 'listing_claimed' (claimed); merchants join by site_slug.
import { supabaseAdmin } from '@/lib/supabase/admin';

/** Menu items across the menu block's sections (0 if none) — the "real menu" signal. */
function menuItemCount(data: any): number {
  const blocks: any[] = data?.pages?.[0]?.blocks ?? [];
  const menu = blocks.find((b) => b?.type === 'menu');
  const sections: any[] = menu?.content?.sections ?? [];
  return sections.reduce((n, s) => n + (Array.isArray(s?.items) ? s.items.length : 0), 0);
}

export type FunnelStage = { key: string; label: string; count: number };
export type HotDraft = { id: string; name: string; slug: string | null; demand: number; leads: number; claimed: boolean };
export type RecentIntent = { name: string; kind: string; items: string | null; at: string | null };

export type DemandFunnel = {
  stages: FunnelStage[];
  orderIntents: number;
  leads: number;
  paidOrders: number;
  feesCollectedCents: number;
  hottest: HotDraft[];
  recent: RecentIntent[];
};

export async function loadDemandFunnel(): Promise<DemandFunnel> {
  // --- Outreach drafts (unclaimed + claimed) ---
  const { data: draftRows } = await supabaseAdmin
    .from('templates')
    .select('id, slug, business_name, template_name, claim_source, data')
    .in('claim_source', ['listing_import', 'listing_claimed'])
    .limit(1000);
  const rows = (draftRows as any[]) ?? [];
  const draftIds = rows.map((r) => r.id as string);
  const draftsBuilt = rows.length;
  const withMenu = rows.filter((r) => menuItemCount(r.data) > 0).length;
  const claimedRows = rows.filter((r) => r.claim_source === 'listing_claimed');
  const claimed = claimedRows.length;
  const nameOf = (r: any) => r.business_name || r.template_name || r.slug || String(r.id).slice(0, 8);

  // --- Demand events on those drafts ---
  const demandByTemplate = new Map<string, { count: number; leads: number }>();
  let orderIntents = 0;
  let leads = 0;
  let recent: RecentIntent[] = [];
  if (draftIds.length) {
    const { data: ev } = await supabaseAdmin
      .from('demand_events')
      .select('template_id, kind, contact_name, contact_phone, items, created_at')
      .in('template_id', draftIds)
      .order('created_at', { ascending: false });
    const events = (ev as any[]) ?? [];
    for (const e of events) {
      orderIntents += 1;
      const hasContact = !!(e.contact_phone || e.contact_name || e.items);
      if (hasContact) leads += 1;
      const m = demandByTemplate.get(e.template_id) ?? { count: 0, leads: 0 };
      m.count += 1;
      if (hasContact) m.leads += 1;
      demandByTemplate.set(e.template_id, m);
    }
    recent = events.slice(0, 10).map((e) => ({
      name: e.contact_name || (e.kind === 'call' ? 'Tap-to-call' : 'Someone'),
      kind: e.kind,
      items: e.items,
      at: e.created_at,
    }));
  }
  const withDemand = demandByTemplate.size;

  const claimedIds = new Set(claimedRows.map((r) => r.id));
  const hottest: HotDraft[] = [...demandByTemplate.entries()]
    .map(([id, m]) => {
      const r = rows.find((x) => x.id === id);
      return { id, name: r ? nameOf(r) : String(id).slice(0, 8), slug: r?.slug ?? null, demand: m.count, leads: m.leads, claimed: claimedIds.has(id) };
    })
    .sort((a, b) => b.demand - a.demand)
    .slice(0, 5);

  // --- Downstream: claimed drafts → merchants (by slug) → onboarding + paid orders ---
  let onboarded = 0;
  let paying = 0;
  let paidOrders = 0;
  let feesCollectedCents = 0;
  const claimedSlugs = claimedRows.map((r) => r.slug).filter(Boolean) as string[];
  if (claimedSlugs.length) {
    const { data: merch } = await supabaseAdmin.from('merchants').select('id, site_slug').in('site_slug', claimedSlugs);
    const merchIds = ((merch as any[]) ?? []).map((m) => m.id as string);
    if (merchIds.length) {
      const { data: pa } = await supabaseAdmin.from('payment_accounts').select('merchant_id').in('merchant_id', merchIds);
      onboarded = new Set(((pa as any[]) ?? []).map((p) => p.merchant_id)).size;
      const { data: ords } = await supabaseAdmin.from('orders').select('merchant_id, platform_fee_cents').eq('status', 'paid').in('merchant_id', merchIds);
      const orders = (ords as any[]) ?? [];
      paidOrders = orders.length;
      paying = new Set(orders.map((o) => o.merchant_id)).size;
      feesCollectedCents = orders.reduce((s, o) => s + (Number(o.platform_fee_cents) || 0), 0);
    }
  }

  const stages: FunnelStage[] = [
    { key: 'built', label: 'Drafts built', count: draftsBuilt },
    { key: 'menu', label: 'With a real menu', count: withMenu },
    { key: 'demand', label: 'Generating demand', count: withDemand },
    { key: 'claimed', label: 'Claimed', count: claimed },
    { key: 'onboarded', label: 'Onboarded (Stripe)', count: onboarded },
    { key: 'paying', label: 'Taking orders', count: paying },
  ];

  return { stages, orderIntents, leads, paidOrders, feesCollectedCents, hottest, recent };
}
