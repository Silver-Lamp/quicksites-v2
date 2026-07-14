// lib/ops/opsSnapshotServer.ts
//
// Server-side assembler for the ops dashboard. Gathers everything the dashboard needs
// that lives in our own DB (inventory, revenue, clients, prospects, campaigns) in
// parallel. The one signal it can't pre-compute is live Google rank — that needs a
// per-domain OAuth round-trip and already has a route (/api/gsc/summary), so the
// client fetches it and finishes the "ranked but not rented" cross-reference there.
//
// Everything is best-effort per section: a missing table/column degrades that tile to
// zeros rather than 500-ing the whole page (types/supabase.ts is stale for some of
// these tables, so queries are untyped).

import { createClient } from '@supabase/supabase-js';
import { assembleOwnedInventory } from '@/lib/domains/ownedInventoryServer';
import { summarizePlatformRevenue, type RevenueSummary } from '@/lib/commerce/revenue';
import { loadProspectsWorkspaceData } from '@/lib/outreach/growthData';
import type { InventoryDomain, DomainRollup, SpendProjectionPoint } from '@/lib/domains/ownedInventory';
import type { GeoCampaign } from '@/lib/outreach/geoCampaigns';
import type { Prospect } from '@/lib/outreach/prospects';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const LAPSED_DAYS = 90;

export type OpsClients = {
  activeSubscribers: number;
  mrrCents: number;
  customers: number;
  repeatBuyers: number;
  lapsedCustomers: number;
  totalLtvCents: number;
};

export type OpsSnapshot = {
  inventory: {
    domains: InventoryDomain[];
    rollup: DomainRollup;
    projection: SpendProjectionPoint[];
    projectionByExpiry: SpendProjectionPoint[];
    vercelUnavailable: boolean;
  };
  revenue: RevenueSummary;
  clients: OpsClients;
  markets: {
    prospects: Prospect[];
    campaigns: GeoCampaign[];
    channels: { mail: boolean; sms: boolean; call: boolean };
  };
};

/** Platform revenue roll-up from paid orders + attributed commissions. */
async function loadRevenue(): Promise<RevenueSummary> {
  try {
    const [ordersRes, commsRes] = await Promise.all([
      admin.from('orders').select('status, total_cents, platform_fee_cents').limit(10000),
      admin
        .from('commission_ledger')
        .select('status, amount_cents, subject')
        .in('subject', ['order_platform_fee', 'order_platform_fee_override'])
        .limit(10000),
    ]);
    return summarizePlatformRevenue({
      orders: (ordersRes.data as any[]) ?? [],
      commissions: (commsRes.data as any[]) ?? [],
    });
  } catch {
    return summarizePlatformRevenue({ orders: [], commissions: [] });
  }
}

/** Customer + subscription roll-up (deny-default tables → service role). */
async function loadClients(nowMs: number): Promise<OpsClients> {
  const out: OpsClients = { activeSubscribers: 0, mrrCents: 0, customers: 0, repeatBuyers: 0, lapsedCustomers: 0, totalLtvCents: 0 };

  try {
    const { data } = await admin.from('customers').select('lifetime_cents, orders_count, last_order_at').limit(10000);
    const rows = (data as any[]) ?? [];
    out.customers = rows.length;
    const lapsedBefore = nowMs - LAPSED_DAYS * 86_400_000;
    for (const r of rows) {
      out.totalLtvCents += Number(r.lifetime_cents) || 0;
      if ((Number(r.orders_count) || 0) >= 2) out.repeatBuyers += 1;
      const last = r.last_order_at ? new Date(r.last_order_at).getTime() : NaN;
      if (Number.isFinite(last) && last < lapsedBefore) out.lapsedCustomers += 1;
    }
  } catch {
    /* customers table absent → leave zeros */
  }

  try {
    const { data } = await admin.from('merchant_billing').select('price_cents, stripe_subscription_id').limit(10000);
    const rows = (data as any[]) ?? [];
    for (const r of rows) {
      if (r.stripe_subscription_id) {
        out.activeSubscribers += 1;
        out.mrrCents += Number(r.price_cents) || 0;
      }
    }
  } catch {
    /* merchant_billing absent → leave zeros */
  }

  return out;
}

/** Assemble the full server-side snapshot for the ops dashboard. */
export async function assembleOpsSnapshot(): Promise<OpsSnapshot> {
  const nowMs = Date.now();
  const [inv, revenue, clients, market] = await Promise.all([
    assembleOwnedInventory(12),
    loadRevenue(),
    loadClients(nowMs),
    loadProspectsWorkspaceData(),
  ]);

  return {
    inventory: {
      domains: inv.domains,
      rollup: inv.rollup,
      projection: inv.projection,
      projectionByExpiry: inv.projectionByExpiry,
      vercelUnavailable: inv.vercelUnavailable,
    },
    revenue,
    clients,
    markets: {
      prospects: market.prospects,
      campaigns: market.campaigns,
      channels: market.channels,
    },
  };
}
