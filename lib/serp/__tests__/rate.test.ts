/**
 * @jest-environment node
 */
import { rateNiche, rateQuery, readsToResolve, wilson, type RateInput } from '@/lib/serp/rate';

const read = (packSize: number, aiOverview = false): RateInput => ({
  packSize,
  aiOverview,
  verdict: packSize >= 3 ? 'skip' : 'good',
});
const rate = (reads: RateInput[]) => rateQuery('q', 'Austin,Texas,United States', reads);

describe('the interval is the point of this module', () => {
  // The normal approximation gives [1, 1] here: total certainty from five observations. That is
  // the failure the binary sweep already made once, and it would arrive wearing an error bar.
  it('does not claim certainty from a unanimous small sample', () => {
    const { lo, hi } = wilson(5, 5);
    expect(hi).toBe(1);
    expect(lo).toBeGreaterThan(0.5);
    expect(lo).toBeLessThan(0.7);
  });

  it('an empty sample knows nothing rather than claiming zero', () => {
    expect(wilson(0, 0)).toEqual({ lo: 0, hi: 1 });
  });
});

describe('4 of 5 sounds decisive and is not', () => {
  // 80% pack-free does not even establish that the pack is absent more often than present.
  // Calling this `winnable` is exactly the n=3 mistake.
  it('reads contested, not winnable', () => {
    const r = rate([read(0), read(0), read(0), read(0), read(3)]);
    expect(r.packFreeRate).toBeCloseTo(0.8);
    expect(r.lo).toBeLessThan(0.5);
    expect(r.verdict).toBe('contested');
  });

  it('a unanimous K=5 resolves, which is the price of the threshold', () => {
    expect(rate([read(0), read(0), read(0), read(0), read(0)]).verdict).toBe('winnable');
    expect(rate([read(3), read(3), read(3), read(3), read(3)]).verdict).toBe('lost');
  });
});

describe('the real treehouse pair', () => {
  // treehouse builder denver, same location, same se_results_count, half an hour apart: one page
  // led with an AI overview and no pack, the other with a full pack and no AI overview.
  const pair = rate([read(0, true), read(3, false)]);

  it('one-for-one is contested, not a 50% score to rank on', () => {
    expect(pair.verdict).toBe('contested');
    expect(pair.packFreeRate).toBe(0.5);
  });

  it('records that the reads actually differed', () => {
    expect(pair.varied).toBe(true);
  });

  // ⚠️ If reads never vary anywhere, suspect a cached provider response: identical reads produce a
  // tight interval and therefore FALSE confidence — this module's own failure, one level up.
  it('flags identical reads, which is what a cache looks like', () => {
    expect(rate([read(0), read(0), read(0)]).varied).toBe(false);
  });
});

describe('a niche is only as good as its worst resolved query', () => {
  const winnable = rate([read(0), read(0), read(0), read(0), read(0)]);
  const lost = rate([read(3), read(3), read(3), read(3), read(3)]);
  const contested = rate([read(0), read(3)]);

  it('one definitively lost query is a constraint, not an average', () => {
    // The mean pack-free rate here is 50%, which would rank mid-table. It is not mid-table: one of
    // the two pages cannot be won at all.
    const n = rateNiche('k', [winnable, lost]);
    expect(n.packFreeRate).toBeCloseTo(0.5);
    expect(n.verdict).toBe('lost');
  });

  it('needs every query to resolve before it claims winnable', () => {
    expect(rateNiche('k', [winnable, contested]).verdict).toBe('contested');
    expect(rateNiche('k', [winnable, winnable]).verdict).toBe('winnable');
  });

  it('weights queries equally so a re-read query cannot outvote the others', () => {
    const readOften = rate(Array(20).fill(read(0)));
    const readOnce = rate([read(3), read(3), read(3), read(3), read(3)]);
    expect(rateNiche('k', [readOften, readOnce]).packFreeRate).toBeCloseTo(0.5);
  });

  it('an empty niche claims nothing', () => {
    expect(rateNiche('k', []).verdict).toBe('contested');
  });
});

describe('aiming the next spend', () => {
  it('says how many more reads a contested query needs', () => {
    const r = rate([read(0), read(0), read(0), read(0), read(3)]);
    const more = readsToResolve(r);
    expect(more).not.toBeNull();
    expect(more!).toBeGreaterThan(0);
  });

  it('refuses to sell an unbounded budget on a genuine coin flip', () => {
    // 50/50 never resolves. Returning a number here would promise a purchase that cannot arrive.
    expect(readsToResolve(rate([read(0), read(3)]))).toBeNull();
  });

  it('asks for nothing once resolved', () => {
    expect(readsToResolve(rate([read(0), read(0), read(0), read(0), read(0)]))).toBe(0);
  });
});
