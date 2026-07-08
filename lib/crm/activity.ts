// lib/crm/activity.ts
//
// CRM Phase 2: unify a customer's events into one chronological timeline. Every
// source is keyed to customer_id (orders, campaign receipts) so there's no
// cross-tenant matching — the merchant only ever sees their own customer's history.
// Pure merge/sort; the component owns presentation.

export type ActivityEvent =
  | { kind: 'order'; id: string; at: string; totalCents: number; currency: string; status: string; siteSlug: string | null }
  | { kind: 'campaign'; id: string; at: string; subject: string; status: string }
  | { kind: 'created'; id: 'created'; at: string };

export type ActivityInput = {
  orders: Array<{ id: string; created_at: string | null; status: string; total_cents: number; currency?: string | null; site_slug?: string | null }>;
  campaignSends: Array<{ id: string; created_at: string | null; status: string; subject: string | null }>;
  createdAt: string | null;
  firstOrderAt: string | null;
};

export function buildCustomerActivity(input: ActivityInput): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const o of input.orders) {
    if (!o.created_at) continue;
    events.push({
      kind: 'order',
      id: `order-${o.id}`,
      at: o.created_at,
      totalCents: o.total_cents || 0,
      currency: (o.currency || 'USD').toUpperCase(),
      status: o.status,
      siteSlug: o.site_slug ?? null,
    });
  }

  for (const s of input.campaignSends) {
    if (!s.created_at) continue;
    events.push({
      kind: 'campaign',
      id: `camp-${s.id}`,
      at: s.created_at,
      subject: s.subject || '(no subject)',
      status: s.status,
    });
  }

  // A single "became a customer" marker — prefer the row's created_at, fall back to
  // the earliest order (backfilled customers may predate their created_at semantics).
  const created = input.createdAt || input.firstOrderAt;
  if (created) events.push({ kind: 'created', id: 'created', at: created });

  return events
    .filter((e) => e.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
