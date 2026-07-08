// lib/crm/attribution.ts
//
// CRM Phase 3 metrics: attribute paid orders to the campaign that likely drove them.
// Read-time only — no writes, no coupling into the money path. Last-touch within a
// window: each order is credited to the MOST RECENT campaign (by send time) that
// (a) reached that customer and (b) was sent within `windowDays` before the order —
// so revenue is never double-counted across overlapping campaigns.

export const ATTRIBUTION_WINDOW_DAYS = 7;

export type AttributionResult = { orders: number; revenueCents: number };

export function attributeOrders(input: {
  campaigns: Array<{ id: string; sent_at: string | null }>;
  /** campaignId → set of recipient customer_ids (status='sent'). */
  sendsByCampaign: Map<string, Set<string>>;
  /** Paid orders for the merchant: who, when, how much. */
  orders: Array<{ customer_id: string | null; created_at: string | null; total_cents: number }>;
  windowDays?: number;
}): Map<string, AttributionResult> {
  const windowMs = (input.windowDays ?? ATTRIBUTION_WINDOW_DAYS) * 86_400_000;

  // Most-recent-first so the first matching campaign per order is the last touch.
  const sent = input.campaigns
    .filter((c) => c.sent_at)
    .map((c) => ({ id: c.id, at: new Date(c.sent_at as string).getTime() }))
    .sort((a, b) => b.at - a.at);

  const result = new Map<string, AttributionResult>();
  for (const c of sent) result.set(c.id, { orders: 0, revenueCents: 0 });

  for (const o of input.orders) {
    if (!o.customer_id || !o.created_at) continue;
    const ot = new Date(o.created_at).getTime();
    for (const c of sent) {
      // Ordered most-recent-first: the first campaign whose window brackets the order
      // and that reached this customer wins (last touch).
      if (c.at <= ot && ot <= c.at + windowMs && input.sendsByCampaign.get(c.id)?.has(o.customer_id)) {
        const r = result.get(c.id)!;
        r.orders += 1;
        r.revenueCents += Math.max(0, o.total_cents || 0);
        break;
      }
    }
  }
  return result;
}
