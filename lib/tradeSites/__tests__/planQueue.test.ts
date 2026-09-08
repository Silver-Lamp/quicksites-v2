/**
 * @jest-environment node
 */
// "Queue these 14" must not reshuffle what a person already queued, and must say what it does.
import { readFileSync } from 'node:fs';
import { prioritiesBehind } from '@/lib/tradeSites/planQueue';
import { orderQueue } from '@/lib/tradeSites/pipeline';
import { planSweepQueue, LOW_YIELD_RATE } from '@/lib/tradeSites/queuePlanner';
import { resolveSweepCategory } from '@/lib/prospects/sweepCategories';

describe('a new plan lands BEHIND the existing queue', () => {
  it('starts one below the lowest queued priority and descends in plan order', () => {
    expect(prioritiesBehind([13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 3)).toEqual([0, -1, -2]);
  });

  it('with an empty queue it still descends from 0', () => {
    expect(prioritiesBehind([], 3)).toEqual([0, -1, -2]);
  });

  it('⚠️ the drain runs every existing row before any new one — the interleave that the first version produced', () => {
    const existing = Array.from({ length: 13 }, (_, i) => ({ id: `old${i}`, priority: 13 - i, created_at: '2026-09-08T12:39:38Z' }));
    const pr = prioritiesBehind(existing.map((r) => r.priority), 14);
    const added = pr.map((priority, i) => ({ id: `new${i}`, priority, created_at: '2026-09-08T19:00:00Z' }));
    const order = orderQueue([...added, ...existing]).map((r) => r.id);
    expect(order.slice(0, 13).every((id) => id.startsWith('old'))).toBe(true);
    expect(order.slice(13)).toEqual(added.map((r) => r.id)); // and the plan's own order is kept
    // The old numbering (14..1) would have put new0 first and alternated. Prove that is what we avoided.
    const oldStyle = added.map((r, i) => ({ ...r, priority: 14 - i }));
    expect(orderQueue([...oldStyle, ...existing])[0].id).toBe('new0');
  });
});

describe('the plan carries its expected yield so the UI can tag low-yield rows', () => {
  it('a searched-for trade (roofing, 3% prior) is below the low-yield line; towing is above it', () => {
    const { plan } = planSweepQueue({
      now: new Date('2026-09-08T00:00:00Z'),
      categoryFor: (industry) => resolveSweepCategory(industry)?.label ?? null,
      alreadyQueued: [],
      campaigns: [
        { city: 'Boston', region: 'MA', industry_key: 'roofing', domain: 'boston-roofing.com', domain_status: 'registered' },
        { city: 'Arab', region: 'AL', industry_key: 'towing', domain: 'arab-towing.com', domain_status: 'registered' },
      ],
      history: [],
    });
    const roofing = plan.find((p) => p.industry === 'roofing')!;
    const towing = plan.find((p) => p.industry === 'towing')!;
    expect(roofing.rate).toBeLessThan(LOW_YIELD_RATE);
    expect(roofing.measured).toBe(false);
    expect(towing.rate).toBeGreaterThan(LOW_YIELD_RATE);
  });
});

describe('the button says what it does', () => {
  const ui = readFileSync('components/admin/trade-pipeline-queue.tsx', 'utf8');
  it('names the count it adds and the count already ahead — never a bare "Queue these"', () => {
    expect(ui).not.toMatch(/Queue these \{/);
    expect(ui).toMatch(/Add \{tickedCount\} after the \{queued\} queued/);
  });
  it('sends the ticked subset, not a flag that re-plans server-side', () => {
    expect(ui).toMatch(/rows\s*\}\)/);
  });
  it('tags low yield from the shared constant, not a literal', () => {
    expect(ui).toMatch(/p\.rate < LOW_YIELD_RATE/);
  });
});
