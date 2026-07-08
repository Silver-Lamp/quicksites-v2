// lib/crm/segments.ts
//
// Customer segment definitions, shared by the merchant customer list (client
// filtering) and the campaign audience resolver (server) so the two never drift.
// Pure module — no client/server-only imports.

export const RECENT_DAYS = 30; // "Recent" = ordered within this window
export const LAPSED_DAYS = 90; // "Lapsed" = has ordered, but not within this window

export type Segment = 'all' | 'opted_in' | 'repeat' | 'recent' | 'lapsed';

export type SegmentCustomer = {
  marketing_consent: boolean;
  orders_count: number;
  last_order_at: string | null;
};

export const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'all', label: 'All customers' },
  { key: 'opted_in', label: 'Opted in' },
  { key: 'repeat', label: 'Repeat (2+ orders)' },
  { key: 'recent', label: `Recent (ordered ≤${RECENT_DAYS}d)` },
  { key: 'lapsed', label: `Lapsed (>${LAPSED_DAYS}d)` },
];

export function daysSince(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  const ms = now - new Date(iso).getTime();
  return ms < 0 ? 0 : Math.floor(ms / 86_400_000);
}

export function matchesSegment(r: SegmentCustomer, seg: Segment, now = Date.now()): boolean {
  switch (seg) {
    case 'opted_in': return r.marketing_consent;
    case 'repeat': return (r.orders_count || 0) >= 2;
    case 'recent': {
      const d = daysSince(r.last_order_at, now);
      return d !== null && d <= RECENT_DAYS;
    }
    case 'lapsed': {
      const d = daysSince(r.last_order_at, now);
      return d !== null && d > LAPSED_DAYS;
    }
    default: return true;
  }
}

export function isSegment(v: unknown): v is Segment {
  return typeof v === 'string' && ['all', 'opted_in', 'repeat', 'recent', 'lapsed'].includes(v);
}
