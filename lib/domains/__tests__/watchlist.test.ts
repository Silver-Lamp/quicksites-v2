/**
 * @jest-environment node
 */
// lib/domains/__tests__/watchlist.test.ts
//
// Money moves only at or under a cap the owner wrote down. Every other outcome files a task
// and keeps watching. The first entry (richlandtowing.com, 2026-09-16) was a $500 ask on a name
// the registry showed in pending delete — the cap is what turns "negotiate" into "$12 or nothing".

import { decideWatchAction, runDomainWatch, normalizeWatchDomain, type WatchEntry, type WatchRunDeps } from '@/lib/domains/watchlist';

const avail = (over: Partial<Parameters<typeof decideWatchAction>[1]> = {}) => ({
  domain: 'richlandtowing.com',
  available: true,
  priceUsd: 12,
  periodYears: 1,
  premium: false,
  ...over,
});

describe('decideWatchAction', () => {
  const entry = { max_price_usd: 20 };
  it('buys at or under the cap', () => {
    expect(decideWatchAction(entry, avail())).toEqual({ action: 'buy', priceUsd: 12 });
    expect(decideWatchAction(entry, avail({ priceUsd: 20 }))).toEqual({ action: 'buy', priceUsd: 20 });
  });
  it('refuses over the cap and refuses premium pricing even under it', () => {
    expect(decideWatchAction(entry, avail({ priceUsd: 500 }))).toEqual({ action: 'over_cap', priceUsd: 500 });
    expect(decideWatchAction(entry, avail({ premium: true, priceUsd: 15 }))).toEqual({ action: 'over_cap', priceUsd: 15 });
  });
  it('treats an errored check as unknown, never as taken', () => {
    expect(decideWatchAction(entry, avail({ available: false, error: '429' }))).toEqual({ action: 'unknown', reason: '429' });
  });
  it('reports a registered name as taken', () => {
    expect(decideWatchAction(entry, avail({ available: false }))).toEqual({ action: 'taken' });
  });
});

describe('normalizeWatchDomain', () => {
  it('strips scheme/www/path and lowercases', () => {
    expect(normalizeWatchDomain('https://www.RichlandTowing.com/')).toBe('richlandtowing.com');
  });
  it('rejects junk', () => {
    expect(() => normalizeWatchDomain('not a domain')).toThrow();
  });
});

function harness(over: Partial<WatchRunDeps> & { entries?: WatchEntry[] } = {}) {
  const entries: WatchEntry[] = over.entries ?? [
    { domain: 'richlandtowing.com', max_price_usd: 20, added_at: '2026-09-16T00:00:00Z', status: 'watching' },
  ];
  const calls = { purchase: [] as string[], tasks: [] as string[], notify: [] as string[], saved: null as WatchEntry[] | null };
  const deps: WatchRunDeps = {
    list: async () => entries,
    save: async (l) => {
      calls.saved = l;
    },
    availability: async () => avail(),
    purchase: async (d) => {
      calls.purchase.push(d);
      return { ok: true, purchased: true, priceUsd: 12 };
    },
    registry: async () => null,
    registerEnabled: () => true,
    notify: async (s) => {
      calls.notify.push(s);
    },
    task: async (t) => {
      calls.tasks.push(t);
    },
    now: () => new Date('2026-09-17T08:05:00Z'),
    ...over,
  };
  return { deps, calls, entries };
}

describe('runDomainWatch', () => {
  it('buys an available name under the cap, marks it bought, files a bind-it task, emails', async () => {
    const { deps, calls } = harness();
    const r = await runDomainWatch(deps);
    expect(r.bought).toEqual(['richlandtowing.com']);
    expect(calls.purchase).toEqual(['richlandtowing.com']);
    expect(calls.saved?.[0]).toMatchObject({ status: 'bought', price_usd: 12, bought_at: '2026-09-17T08:05:00.000Z' });
    expect(calls.tasks[0]).toMatch(/bought at \$12 — bind it/);
    expect(calls.notify[0]).toMatch(/Bought richlandtowing.com/);
  });

  it('does not buy over the cap; files a task; keeps watching', async () => {
    const { deps, calls } = harness({ availability: async () => avail({ priceUsd: 500 }) });
    const r = await runDomainWatch(deps);
    expect(r.overCap).toEqual(['richlandtowing.com']);
    expect(calls.purchase).toEqual([]);
    expect(calls.saved?.[0].status).toBe('watching');
    expect(calls.tasks[0]).toMatch(/over your \$20 cap/);
  });

  it('while still registered: no purchase, no task, keeps watching, records the registry status', async () => {
    const { deps, calls } = harness({
      availability: async () => avail({ available: false }),
      registry: async () => ['client transfer prohibited', 'pending delete'],
    });
    const r = await runDomainWatch(deps);
    expect(r.taken).toEqual(['richlandtowing.com']);
    expect(calls.purchase).toEqual([]);
    expect(calls.tasks).toEqual([]);
    expect(calls.saved?.[0]).toMatchObject({ status: 'watching', registry_status: ['client transfer prohibited', 'pending delete'] });
    expect(calls.saved?.[0].last_result).toContain('pending delete');
  });

  it('with the register flag off: no purchase, but a same-day task + email so a person buys it', async () => {
    const { deps, calls } = harness({ registerEnabled: () => false });
    const r = await runDomainWatch(deps);
    expect(r.failed).toEqual(['richlandtowing.com']);
    expect(calls.purchase).toEqual([]);
    expect(calls.tasks[0]).toMatch(/register it today/);
  });

  it('a failed purchase files a task and keeps watching', async () => {
    const { deps, calls } = harness({ purchase: async () => ({ ok: false, purchased: false, priceUsd: 12, reason: 'price_changed' }) });
    const r = await runDomainWatch(deps);
    expect(r.failed).toEqual(['richlandtowing.com']);
    expect(calls.saved?.[0].status).toBe('watching');
    expect(calls.tasks[0]).toMatch(/purchase failed — price_changed/);
  });

  it('skips entries that are bought or stopped', async () => {
    const { deps, calls } = harness({
      entries: [
        { domain: 'a.com', max_price_usd: 20, added_at: 'x', status: 'bought' },
        { domain: 'b.com', max_price_usd: 20, added_at: 'x', status: 'stopped' },
      ],
    });
    const r = await runDomainWatch(deps);
    expect(r.checked).toBe(0);
    expect(calls.purchase).toEqual([]);
  });
});
