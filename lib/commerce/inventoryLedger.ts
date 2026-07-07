// lib/commerce/inventoryLedger.ts
//
// Append-only inventory history (INVENTORY_PLAN.md Phase 2). Every stock change —
// sale, refund restock, manual edit — records one row in inventory_adjustments so a
// merchant can audit how a quantity got to where it is. Best-effort: recording never
// blocks the order/refund path (a ledger write failure is logged, not thrown).

export type AdjustmentReason =
  | 'sale'
  | 'refund'
  | 'restock'
  | 'manual'
  | 'receive'
  | 'correction'
  | 'initial';

export type AdjustmentInput = {
  catalogItemId: string;
  variantId?: string | null;
  delta: number; // signed
  newOnHand?: number | null; // resulting qty when known (null = untracked)
  reason: AdjustmentReason;
  orderId?: string | null;
  actorId?: string | null;
  note?: string | null;
};

/**
 * Resolve a manual stock adjustment into a signed delta + reason from either an
 * absolute target (`setTo`) or a signed `delta`. Pure; exported for tests.
 *   - setTo given  → delta = setTo - current, reason 'correction'
 *   - delta given  → reason 'receive' (delta>0) / 'manual' (delta<0)
 * Returns null when there's nothing to change or the input is invalid.
 */
export function resolveManualAdjustment(
  current: number,
  input: { delta?: unknown; setTo?: unknown; reason?: AdjustmentReason },
): { delta: number; reason: AdjustmentReason } | null {
  let delta: number;
  let reason: AdjustmentReason;
  if (input.setTo !== undefined && input.setTo !== null) {
    const target = Math.trunc(Number(input.setTo));
    if (!Number.isFinite(target) || target < 0) return null;
    delta = target - current;
    reason = input.reason ?? 'correction';
  } else {
    delta = Math.trunc(Number(input.delta));
    if (!Number.isFinite(delta)) return null;
    reason = input.reason ?? (delta > 0 ? 'receive' : 'manual');
  }
  if (delta === 0) return null;
  return { delta, reason };
}

/** Insert one adjustment row. `supabase` is a service-role client. Never throws. */
export async function recordAdjustment(supabase: any, a: AdjustmentInput): Promise<void> {
  if (!a.catalogItemId || !Number.isFinite(a.delta) || a.delta === 0) return;
  try {
    const { error } = await supabase.from('inventory_adjustments').insert({
      catalog_item_id: a.catalogItemId,
      variant_id: a.variantId ?? null,
      delta: Math.trunc(a.delta),
      new_on_hand: typeof a.newOnHand === 'number' ? Math.trunc(a.newOnHand) : null,
      reason: a.reason,
      order_id: a.orderId ?? null,
      actor_id: a.actorId ?? null,
      note: a.note ? String(a.note).slice(0, 500) : null,
    });
    if (error) console.warn('[inventoryLedger] record failed:', error.message);
  } catch (e: any) {
    console.warn('[inventoryLedger] record threw:', e?.message || e);
  }
}
