/**
 * @jest-environment node
 */
// lib/outreach/__tests__/cardResponse.test.ts
//
// The claim-card response funnel is pure arithmetic over two row sets. The one rule worth pinning:
// a scan BEFORE the card's forecast delivery is a test scan (ours), and must never count as a
// response — the first two "scans" in production were exactly that.
import fs from 'node:fs';
import path from 'node:path';
import { computeCardResponse, type CardMailingRow, type CardProspectRow } from '@/lib/outreach/cardResponse';

const card = (prospect_id: string, created: string, expected: string, extra: Partial<CardMailingRow> = {}): CardMailingRow => ({
  prospect_id, created_at: `${created}T06:00:00Z`, status: 'created', expected_delivery_date: expected, delivered_at: null, returned_at: null, ...extra,
});
const prospect = (id: string, city: string, region: string, extra: Partial<CardProspectRow> = {}): CardProspectRow => ({
  id, city, region, claim_link_visits: 0, claim_link_visited_at: null, claimed_at: null, ...extra,
});

describe('computeCardResponse', () => {
  const mailings = [
    card('a', '2026-09-09', '2026-09-17'),
    card('b', '2026-09-09', '2026-09-17'),
    card('c', '2026-09-10', '2026-09-21'),
    card('t', '2026-09-09', '2026-09-16', { status: 'test' }),
    card('a', '2026-09-12', '2026-09-21'), // a second card to the same prospect
  ];
  const prospects = [
    prospect('a', 'Arab', 'AL', { claim_link_visits: 3, claim_link_visited_at: '2026-09-08T02:36:00Z' }), // before delivery = test
    prospect('b', 'Chelsea', 'MA', { claim_link_visits: 1, claim_link_visited_at: '2026-09-18T10:00:00Z', claimed_at: '2026-09-18T11:00:00Z' }),
    prospect('c', 'Chelsea', 'MA'),
  ];

  it('excludes test rows, counts one card per prospect, and dates "arrived" from the forecast', () => {
    const r = computeCardResponse(mailings, prospects, '2026-09-18');
    expect(r.mailed).toBe(4); // real cards, incl. the duplicate to a
    expect(r.arrived).toBe(2); // a and b forecast 09-17; c is 09-21
    expect(r.delivered).toBe(0);
  });

  it('separates a pre-delivery scan (ours) from a real one', () => {
    const r = computeCardResponse(mailings, prospects, '2026-09-18');
    expect(r.visited).toBe(2);
    expect(r.visits).toBe(4);
    expect(r.preDeliveryVisited).toBe(1);
    expect(r.claimed).toBe(1);
    expect(r.firstVisitAt).toBe('2026-09-08T02:36:00Z');
    expect(r.lastVisitAt).toBe('2026-09-18T10:00:00Z');
  });

  it('groups by metro, most mailed first', () => {
    const r = computeCardResponse(mailings, prospects, '2026-09-18');
    expect(r.byMetro.map((m) => [m.city, m.mailed, m.arrived, m.visited, m.claimed])).toEqual([
      ['Chelsea', 2, 1, 1, 1],
      ['Arab', 1, 1, 1, 0],
    ]);
    expect(r.byDay.map((d) => [d.day, d.mailed])).toEqual([['2026-09-09', 2], ['2026-09-10', 1]]);
  });

  it('is empty, not broken, with no cards', () => {
    const r = computeCardResponse([], [], '2026-09-18');
    expect(r.mailed).toBe(0);
    expect(r.byMetro).toEqual([]);
  });
});

describe('source guards', () => {
  it('the trade card QR route mirrors the scan to PostHog', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'app/go/[prospectId]/route.ts'), 'utf8');
    expect(src).toMatch(/EVENTS\.TRADE_CARD_LINK_VISITED/);
  });
  it('the ops dashboard renders the funnel', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'components/admin/ops-dashboard-client.tsx'), 'utf8');
    expect(src).toMatch(/cardResponse\.visited/);
  });
});
