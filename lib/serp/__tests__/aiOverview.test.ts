/**
 * @jest-environment node
 */
import { hasUnfetchedAiOverview, packFreeClaimIsVerifiable } from '@/lib/serp/aiOverview';

const withItems = (items: any[]) => ({ tasks: [{ result: [{ items }] }] });

describe('spotting the box we never opened', () => {
  it('flags the placeholder DataForSEO actually returns', () => {
    // The real shape from our stored readings: the flag set, the contents null.
    expect(
      hasUnfetchedAiOverview(
        withItems([
          { type: 'ai_overview', asynchronous_ai_overview: true, items: null, markdown: null },
          { type: 'organic', domain: 'example.com' },
        ])
      )
    ).toBe(true);
  });

  it('flags null contents even if the flag itself changes shape', () => {
    // Requiring BOTH signals would let a provider rename the flag and silently restore the bug.
    expect(
      hasUnfetchedAiOverview(withItems([{ type: 'ai_overview', items: null, markdown: null }]))
    ).toBe(true);
  });

  it('does not flag an overview whose contents we actually have', () => {
    expect(
      hasUnfetchedAiOverview(
        withItems([
          { type: 'ai_overview', asynchronous_ai_overview: false, items: [{}], markdown: '# hi' },
        ])
      )
    ).toBe(false);
  });

  it('does not flag a page with no overview at all', () => {
    expect(hasUnfetchedAiOverview(withItems([{ type: 'organic' }]))).toBe(false);
  });

  it.each([null, undefined, {}, { tasks: [] }])('survives a malformed payload: %p', (bad) => {
    expect(hasUnfetchedAiOverview(bad)).toBe(false);
  });
});

describe('only the claim the missing data could falsify is poisoned', () => {
  const blindAio = withItems([
    { type: 'ai_overview', asynchronous_ai_overview: true, items: null, markdown: null },
  ]);

  // ⚠️ An unopened overview cannot un-see three map pins. Discarding readings that FOUND a pack
  // would throw away good evidence along with bad, and would make the tool look more pessimistic
  // than the data warrants — the opposite error, but still an error.
  it('keeps a reading that found a full pack', () => {
    expect(packFreeClaimIsVerifiable({ packSize: 3, raw: blindAio })).toBe(true);
  });

  it('rejects a "no pack" reading taken through an unopened overview', () => {
    expect(packFreeClaimIsVerifiable({ packSize: 0, raw: blindAio })).toBe(false);
  });

  it('keeps a "no pack" reading when there was no overview to hide behind', () => {
    expect(
      packFreeClaimIsVerifiable({ packSize: 0, raw: withItems([{ type: 'organic' }]) })
    ).toBe(true);
  });
});

describe('the rate module drops them rather than counting them either way', () => {
  // Counting an unopened box as "a pack was served" would invent evidence in the other direction.
  // The honest answer is that we do not know, and a smaller sample with a wider interval says so.
  const { rateQuery } = require('@/lib/serp/rate');
  const blind = { packSize: 0, aiOverview: true, verdict: 'good', packFreeVerifiable: false };
  const clear = { packSize: 0, aiOverview: false, verdict: 'good', packFreeVerifiable: true };

  it('reports zero reads when every reading was blind', () => {
    // This is exactly what happened to horse barns: 23 readings, all blind, 100% pack-free.
    const r = rateQuery('q', 'L', [blind, blind, blind]);
    expect(r.reads).toBe(0);
    expect(r.blind).toBe(3);
    expect(r.verdict).toBe('contested');
  });

  it('rates only what it could see', () => {
    const r = rateQuery('q', 'L', [blind, clear, clear]);
    expect(r.reads).toBe(2);
    expect(r.blind).toBe(1);
    expect(r.packFreeRate).toBe(1);
  });
});
