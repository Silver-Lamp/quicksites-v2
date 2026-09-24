/**
 * @jest-environment node
 */
import {
  WEAK_REVIEW_COUNT,
  describePackStrength,
  packListingsFromRaw,
  readPackStrength,
} from '@/lib/serp/packStrength';

const v = (...votes: (number | null)[]) => votes.map((x) => ({ votes: x }));

describe('the two controls, which are why this signal is trusted at all', () => {
  // Real numbers from stored readings, 2026-09-24.
  it('towing — the known LOSS — reads as established', () => {
    // position 10.9, 69 impressions, ZERO clicks. Pack of 3 averaging 323 reviews.
    const s = readPackStrength(v(210, 323, 436));
    expect(s.isWeak).toBe(false);
    expect(s.weak).toBe(0);
    expect(describePackStrength(s)).toContain('established');
  });

  it('treehouses — the known WIN — read as weak', () => {
    // A real pack: two businesses Google showed no rating for, one with 4, one with 28.
    const s = readPackStrength(v(null, null, 4, 28));
    expect(s.isWeak).toBe(true);
    expect(s.unrated).toBe(2);
    expect(s.weak).toBe(3);
    expect(describePackStrength(s)).toContain('worth a hand check');
  });
});

describe('an unrated listing counts as weak, not as unknown', () => {
  // ⚠️ Google omits the rating block when there are no reviews to show. Treating that as missing
  // data would read the WEAKEST possible competitor as the most uncertain one — backwards, and
  // biased toward "skip", which is the direction that quietly discards opportunities.
  it('counts unrated toward the weak total', () => {
    const s = readPackStrength(v(null, null, null));
    expect(s.weak).toBe(3);
    expect(s.isWeak).toBe(true);
    expect(s.medianVotes).toBeNull();
  });

  it('does not let unrated listings drag the median', () => {
    // Median is over RATED listings only; nulls are not zeros.
    expect(readPackStrength(v(null, 100, 200)).medianVotes).toBe(150);
  });
});

describe('the threshold', () => {
  it('needs two weak listings, not one', () => {
    expect(readPackStrength(v(5, 400, 500)).isWeak).toBe(false);
    expect(readPackStrength(v(5, 6, 500)).isWeak).toBe(true);
  });

  it('treats the boundary as "20 or more is established"', () => {
    expect(readPackStrength(v(WEAK_REVIEW_COUNT, WEAK_REVIEW_COUNT)).isWeak).toBe(false);
    expect(readPackStrength(v(WEAK_REVIEW_COUNT - 1, WEAK_REVIEW_COUNT - 1)).isWeak).toBe(true);
  });

  it('says nothing about a page with no pack', () => {
    expect(describePackStrength(readPackStrength([]))).toBeNull();
    expect(readPackStrength([]).isWeak).toBe(false);
  });
});

describe('reading it back out of stored raw', () => {
  // This is what makes the signal free: every reading we have ever taken can be scored again.
  const raw = {
    tasks: [
      {
        result: [
          {
            items: [
              { type: 'organic', domain: 'example.com' },
              { type: 'local_pack', title: 'A', rating: { votes_count: 4, value: 5 } },
              { type: 'local_pack', title: 'B' }, // no rating block at all
              { type: 'local_pack', title: 'C', rating: { votes_count: 28, value: 4.9 } },
            ],
          },
        ],
      },
    ],
  };

  it('extracts votes, including the missing ones', () => {
    expect(packListingsFromRaw(raw)).toEqual([{ votes: 4 }, { votes: null }, { votes: 28 }]);
  });

  it('ignores everything that is not a pack listing', () => {
    expect(packListingsFromRaw(raw)).toHaveLength(3);
  });

  it.each([null, undefined, {}, { tasks: [] }, { tasks: [{ result: null }] }])(
    'survives a malformed payload: %p',
    (bad) => {
      expect(packListingsFromRaw(bad)).toEqual([]);
    }
  );
});
