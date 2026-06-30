// lib/commerce/pod/index.ts
//
// Print-on-demand surface for QuickSites Open Commerce. Phase 1: provider
// modules + a feature flag + print_orders persistence. Fulfillment wiring into
// markOrderPaid + status sync is Phase 2 (see docs/POD_AUTHOR_PLAN.md).

import { getServerSupabase } from '@/lib/supabase/server';
import * as lulu from './lulu';
import * as gelato from './gelato';

export { lulu, gelato };

export type PodProvider = 'lulu' | 'gelato';

/** Master gate — POD is off until POD_ENABLED=true (and a provider is configured). */
export function isPodEnabled(): boolean {
  return process.env.POD_ENABLED === 'true';
}

export function isProviderConfigured(p: PodProvider): boolean {
  return p === 'lulu' ? lulu.isLuluConfigured() : gelato.isGelatoConfigured();
}

/** Margin (fraction) added on top of the provider's print cost when pricing POD items. */
export function podMarginPercent(): number {
  const v = Number(process.env.POD_PLATFORM_MARGIN_PERCENT ?? '0.3');
  return Number.isFinite(v) && v >= 0 ? v : 0.3;
}

export type PrintOrderRow = {
  id?: string;
  order_id: string | null;
  merchant_id: string | null;
  provider: PodProvider;
  provider_job_id?: string | null;
  status?: string;
  shipping_address?: any;
  cost_cents?: number | null;
  raw?: any;
};

/** Insert a print_orders row (service role). Returns the new id, or null on failure. */
export async function recordPrintOrder(row: PrintOrderRow): Promise<string | null> {
  try {
    const supa = await getServerSupabase({ serviceRole: true });
    const { data, error } = await (supa as any)
      .from('print_orders')
      .insert({
        order_id: row.order_id,
        merchant_id: row.merchant_id,
        provider: row.provider,
        provider_job_id: row.provider_job_id ?? null,
        status: row.status ?? 'pending',
        shipping_address: row.shipping_address ?? null,
        cost_cents: row.cost_cents ?? null,
        raw: row.raw ?? null,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error) return null;
    return data?.id ?? null;
  } catch {
    return null;
  }
}

/** Update a print_orders row's status / provider job id (service role). */
export async function updatePrintOrder(id: string, patch: Partial<PrintOrderRow>): Promise<void> {
  try {
    const supa = await getServerSupabase({ serviceRole: true });
    await (supa as any)
      .from('print_orders')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
  } catch {
    /* best-effort */
  }
}
