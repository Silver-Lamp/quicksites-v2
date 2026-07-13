/**
 * @jest-environment node
 */
// lib/outreach/__tests__/placeSignals.test.ts

import { selectStaleSignalTargets, SIGNAL_TTL_MS, type SignalRow } from '@/lib/outreach/placeSignals';

const NOW = 1_800_000_000_000; // fixed clock
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

const row = (over: Partial<SignalRow> & { id: string }): SignalRow => ({
  place_id: over.place_id ?? `pid_${over.id}`,
  place_signals_synced_at: over.place_signals_synced_at ?? null,
  ...over,
});

describe('selectStaleSignalTargets', () => {
  it('treats never-synced rows as stale', () => {
    const { targets, eligible } = selectStaleSignalTargets([row({ id: 'a' })], { now: NOW });
    expect(eligible).toBe(1);
    expect(targets.map((t) => t.id)).toEqual(['a']);
  });

  it('refreshes rows older than the TTL, skips fresh ones', () => {
    const rows = [
      row({ id: 'fresh', place_signals_synced_at: iso(SIGNAL_TTL_MS - 1000) }),
      row({ id: 'stale', place_signals_synced_at: iso(SIGNAL_TTL_MS + 1000) }),
    ];
    const { targets, eligible } = selectStaleSignalTargets(rows, { now: NOW });
    expect(eligible).toBe(1);
    expect(targets.map((t) => t.id)).toEqual(['stale']);
  });

  it('skips rows without a place_id', () => {
    const { eligible } = selectStaleSignalTargets([row({ id: 'a', place_id: null })], { now: NOW });
    expect(eligible).toBe(0);
  });

  it('caps targets at the limit (rest deferred)', () => {
    const rows = ['a', 'b', 'c', 'd'].map((id) => row({ id }));
    const { targets, eligible } = selectStaleSignalTargets(rows, { now: NOW, limit: 2 });
    expect(eligible).toBe(4);
    expect(targets).toHaveLength(2);
  });

  it('honors a custom TTL', () => {
    const rows = [row({ id: 'a', place_signals_synced_at: iso(2000) })];
    expect(selectStaleSignalTargets(rows, { now: NOW, ttlMs: 1000 }).eligible).toBe(1); // 2s > 1s TTL
    expect(selectStaleSignalTargets(rows, { now: NOW, ttlMs: 5000 }).eligible).toBe(0); // 2s < 5s TTL
  });
});
