// lib/outreach/cardResponse.ts
//
// The claim-postcard response funnel, as numbers: cards mailed → cards that should have arrived →
// QR scans (the tracked /go/<prospectId> link) → claims. Pure: `computeCardResponse` takes rows;
// `lib/outreach/cardResponseServer.ts` fetches them.
//
// ⚠️ WHY THIS EXISTS. On 2026-09-16, 72 real cards were in the mail and the only way to learn
// whether a single QR had been scanned was a SQL query: the `/go` route counted visits on the
// prospect row and nothing rendered the counter. The owner was reading "76 delivered" off Lob's
// dashboard — data that never reaches us because the Lob webhook is not registered — and asking
// whether PostHog could show scans (it could not: the trade link emitted no event). A number
// nobody can see is a number nobody acts on.
//
// ⚠️ "SHOULD HAVE ARRIVED" IS AN ESTIMATE, NOT A DELIVERY. `expected_delivery_date` is Lob's
// forecast at print time. `delivered` is only ever true from a webhook event, and reads 0 until the
// owner registers the webhook — the tile says so rather than pretending.

export type CardMailingRow = {
  prospect_id: string | null;
  created_at: string;
  status: string;
  expected_delivery_date: string | null;
  delivered_at: string | null;
  returned_at: string | null;
};

export type CardProspectRow = {
  id: string;
  city: string | null;
  region: string | null;
  claim_link_visits: number | null;
  claim_link_visited_at: string | null;
  claimed_at: string | null;
};

export type CardResponseMetro = {
  city: string;
  region: string;
  mailed: number;
  arrived: number;
  visited: number;
  visits: number;
  claimed: number;
};

export type CardResponseDay = { day: string; mailed: number; arrived: number; visited: number };

export type CardResponse = {
  /** Real cards (test rows excluded). */
  mailed: number;
  /** Cards whose expected delivery date is today or earlier. */
  arrived: number;
  /** Cards Lob told us were delivered — 0 until the Lob webhook is registered. */
  delivered: number;
  returned: number;
  /** Prospects with at least one scan of their card's tracked link. */
  visited: number;
  /** Total scans across those prospects. */
  visits: number;
  /** Prospects that claimed their site. */
  claimed: number;
  /** Scans that happened BEFORE the card could have arrived — test scans, not responses. */
  preDeliveryVisited: number;
  firstVisitAt: string | null;
  lastVisitAt: string | null;
  byMetro: CardResponseMetro[];
  byDay: CardResponseDay[];
};

const day = (iso: string) => iso.slice(0, 10);

/** Aggregate the funnel. `today` is an ISO date (YYYY-MM-DD) so the "arrived" cut-off is testable. */
export function computeCardResponse(mailings: CardMailingRow[], prospects: CardProspectRow[], today: string): CardResponse {
  const real = mailings.filter((m) => m.status !== 'test' && m.prospect_id);
  const byId = new Map(prospects.map((p) => [p.id, p]));

  // One card per prospect for the funnel (a prospect may have been mailed twice by hand); the
  // earliest expected delivery is the one that could have produced a scan.
  const firstCard = new Map<string, CardMailingRow>();
  for (const m of real) {
    const prev = firstCard.get(m.prospect_id!);
    if (!prev || m.created_at < prev.created_at) firstCard.set(m.prospect_id!, m);
  }

  const arrivedIds = new Set<string>();
  for (const [pid, m] of firstCard) if (m.expected_delivery_date && m.expected_delivery_date <= today) arrivedIds.add(pid);

  let visited = 0, visits = 0, claimed = 0, preDeliveryVisited = 0;
  let firstVisitAt: string | null = null, lastVisitAt: string | null = null;
  const metros = new Map<string, CardResponseMetro>();
  const days = new Map<string, CardResponseDay>();

  for (const [pid, m] of firstCard) {
    const p = byId.get(pid);
    const key = `${p?.city ?? '?'}|${p?.region ?? ''}`;
    const metro = metros.get(key) ?? { city: p?.city ?? '?', region: p?.region ?? '', mailed: 0, arrived: 0, visited: 0, visits: 0, claimed: 0 };
    const d = days.get(day(m.created_at)) ?? { day: day(m.created_at), mailed: 0, arrived: 0, visited: 0 };
    metro.mailed++; d.mailed++;
    const arrived = arrivedIds.has(pid);
    if (arrived) { metro.arrived++; d.arrived++; }
    const n = p?.claim_link_visits ?? 0;
    if (n > 0) {
      visited++; visits += n; metro.visited++; metro.visits += n; d.visited++;
      const at = p?.claim_link_visited_at ?? null;
      // A scan before the card's expected delivery is a test scan (ours), not a prospect.
      if (at && m.expected_delivery_date && day(at) < m.expected_delivery_date) preDeliveryVisited++;
      if (at && (!firstVisitAt || at < firstVisitAt)) firstVisitAt = at;
      if (at && (!lastVisitAt || at > lastVisitAt)) lastVisitAt = at;
    }
    if (p?.claimed_at) { claimed++; metro.claimed++; }
    metros.set(key, metro); days.set(d.day, d);
  }

  return {
    mailed: real.length,
    arrived: arrivedIds.size,
    delivered: real.filter((m) => m.delivered_at).length,
    returned: real.filter((m) => m.returned_at).length,
    visited,
    visits,
    claimed,
    preDeliveryVisited,
    firstVisitAt,
    lastVisitAt,
    byMetro: [...metros.values()].sort((a, b) => b.mailed - a.mailed || a.city.localeCompare(b.city)),
    byDay: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
  };
}
