// lib/proof/__tests__/rankingSnapshot.test.ts
//
// Pins the SHAPE that /proof/rankings reads out of lib/proof/rankingSnapshot.json.
//
// ⚠️ Why this exists. `kind` was hand-assigned once and nothing produced it: the page filtered and
// coloured by it, while `gsc-rank-report.mjs --json` emitted a different shape with no kind at all.
// So "regenerate the snapshot" silently meant "write a file the page cannot read" — and the only
// symptom would have been a prospect-facing chart quietly losing its categories. The rules now live
// in the script; this asserts the page and the script still agree on the contract between them.
import snapshot from '../rankingSnapshot.json';

const KINDS = ['city_trade', 'generic', 'other'];

describe('rankingSnapshot.json matches what /proof/rankings reads', () => {
  it('has a dated window (the page renders the date; an undated snapshot is a lie by omission)', () => {
    expect(typeof (snapshot as any).measuredAt).toBe('string');
    expect(typeof (snapshot as any).window?.start).toBe('string');
    expect(typeof (snapshot as any).window?.end).toBe('string');
  });

  it('scans a non-empty set of sites and queries', () => {
    // A sweep that matches nothing reports success; assert there is something to check.
    expect(Array.isArray((snapshot as any).sites)).toBe(true);
    expect((snapshot as any).sites.length).toBeGreaterThan(5);
    const queries = (snapshot as any).sites.flatMap((s: any) => s.queries ?? []);
    expect(queries.length).toBeGreaterThan(20);
  });

  it('gives every site the fields the page destructures', () => {
    for (const s of (snapshot as any).sites) {
      expect(typeof s.host).toBe('string');
      expect(s.host).not.toMatch(/^https?:\/\/|^www\.|^sc-domain:/); // normalised host, not a URL
      expect(typeof s.clicks).toBe('number');
      expect(typeof s.impressions).toBe('number');
      expect(Array.isArray(s.queries)).toBe(true);
    }
  });

  it('gives every query a kind the chart knows how to draw', () => {
    for (const s of (snapshot as any).sites) {
      for (const q of s.queries) {
        expect(typeof q.query).toBe('string');
        expect(typeof q.position).toBe('number');
        expect(typeof q.clicks).toBe('number');
        expect(typeof q.impressions).toBe('number');
        // The failure this whole file exists for: a regenerated snapshot with kind undefined
        // renders an uncategorised chart and nothing throws.
        expect(KINDS).toContain(q.kind);
      }
    }
  });
});
