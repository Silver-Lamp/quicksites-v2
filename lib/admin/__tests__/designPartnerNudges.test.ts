/**
 * @jest-environment node
 */
// lib/admin/__tests__/designPartnerNudges.test.ts

import { computeNudges, nudgeLine } from '@/lib/admin/designPartnerNudges';
import type { DesignPartner } from '@/lib/admin/designPartners';

const NOW = Date.parse('2026-07-18T12:00:00Z');
const iso = (daysFromNow: number) => new Date(NOW + daysFromNow * 86400000).toISOString();

const mk = (over: Partial<DesignPartner>): DesignPartner => ({
  id: over.id || 'x',
  name: over.name || 'X',
  forPage: '/for-x',
  role: 'r',
  blurb: 'b',
  status: over.status || 'contacted',
  ...over,
});

describe('computeNudges', () => {
  it('flags an overdue next step as highest priority', () => {
    const n = computeNudges([mk({ id: 'a', name: 'A', nextStepDue: iso(-2) })], { nowMs: NOW });
    expect(n).toHaveLength(1);
    expect(n[0].reasons).toContain('overdue');
    expect(n[0].priority).toBe(3);
  });

  it('flags due-soon within the window', () => {
    const n = computeNudges([mk({ id: 'b', nextStepDue: iso(2) })], { nowMs: NOW, dueSoonDays: 3 });
    expect(n[0].reasons).toContain('due_soon');
  });

  it('flags an in-progress partner gone stale (last nudge > N days)', () => {
    const n = computeNudges([mk({ id: 'c', status: 'engaged', lastNudgedAt: iso(-10) })], {
      nowMs: NOW,
      staleDays: 7,
    });
    expect(n[0].reasons).toContain('stale');
  });

  it('flags never-touched in-progress partners', () => {
    const n = computeNudges([mk({ id: 'd', status: 'contacted' })], { nowMs: NOW });
    expect(n[0].reasons).toContain('never_touched');
  });

  it('skips paused partners and freshly-nudged ones', () => {
    const partners = [
      mk({ id: 'e', status: 'paused', nextStepDue: iso(-5) }), // overdue but paused → skip
      mk({ id: 'f', status: 'engaged', lastNudgedAt: iso(-1) }), // recently nudged, no due date → skip
    ];
    expect(computeNudges(partners, { nowMs: NOW, staleDays: 7 })).toHaveLength(0);
  });

  it('sorts overdue above stale', () => {
    const partners = [
      mk({ id: 'stale', status: 'engaged', lastNudgedAt: iso(-30) }),
      mk({ id: 'over', nextStepDue: iso(-1) }),
    ];
    const n = computeNudges(partners, { nowMs: NOW, staleDays: 7 });
    expect(n[0].id).toBe('over');
  });

  it('nudgeLine renders a readable summary', () => {
    const [n] = computeNudges(
      [mk({ id: 'g', name: 'Gina', nextStep: 'Send the deck', nextStepDue: iso(-1) })],
      { nowMs: NOW }
    );
    expect(nudgeLine(n)).toContain('Gina');
    expect(nudgeLine(n)).toContain('OVERDUE');
    expect(nudgeLine(n)).toContain('Send the deck');
  });
});
