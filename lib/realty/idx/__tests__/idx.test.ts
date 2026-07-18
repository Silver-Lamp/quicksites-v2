/**
 * @jest-environment node
 */
// lib/realty/idx/__tests__/idx.test.ts
//
// The provider-agnostic IDX client: mock provider filtering + config resolution + the
// searchListings orchestration (mock fallback in non-prod, compliance block attached).

import { mockProvider } from '@/lib/realty/idx/mockProvider';
import { resolveIdxConfig, searchListings } from '@/lib/realty/idx';

describe('mockProvider.search', () => {
  it('filters by price + beds and paginates', async () => {
    const all = await mockProvider.search({ provider: 'mock' }, {});
    expect(all.total).toBeGreaterThan(0);

    const cheap = await mockProvider.search({ provider: 'mock' }, { maxPrice: 500000 });
    expect(cheap.listings.every((l) => l.price <= 500000)).toBe(true);

    const big = await mockProvider.search({ provider: 'mock' }, { minBeds: 4 });
    expect(big.listings.every((l) => (l.beds ?? 0) >= 4)).toBe(true);
  });

  it('text-matches address/city/zip', async () => {
    const r = await mockProvider.search({ provider: 'mock' }, { q: 'highlands' });
    expect(r.listings.length).toBe(1);
    expect(r.listings[0].address.toLowerCase()).toContain('highlands');
  });
});

describe('resolveIdxConfig', () => {
  it('reads provider config off template.data.meta.idx', () => {
    const cfg = resolveIdxConfig({
      data: { meta: { idx: { provider: 'bridge', dataset: 'test', token: 'x' } } },
    });
    expect(cfg).toMatchObject({ provider: 'bridge', dataset: 'test', token: 'x' });
  });
  it('returns null when absent or invalid', () => {
    expect(resolveIdxConfig({})).toBeNull();
    expect(resolveIdxConfig({ data: { meta: { idx: { provider: 'nope' } } } })).toBeNull();
  });
});

describe('searchListings (non-prod mock fallback)', () => {
  it('serves the mock feed + attaches a compliance block when no config is set', async () => {
    const out = await searchListings({}, {});
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.result.listings.length).toBeGreaterThan(0);
      expect(out.result.compliance.disclaimer).toMatch(/reliable/i);
    }
  });
});
