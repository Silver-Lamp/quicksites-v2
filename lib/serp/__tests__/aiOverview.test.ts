/**
 * @jest-environment node
 */
import {
  aiOverviewCitesLocalBusinesses,
  hasLocalCompetitionAbove,
  hasUnfetchedAiOverview,
  packFreeClaimIsVerifiable,
} from '@/lib/serp/aiOverview';

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

describe('detecting the local pack hiding inside a fetched overview', () => {
  const overview = (elements: any[]) => ({
    tasks: [{ result: [{ items: [{ type: 'ai_overview', asynchronous_ai_overview: false, items: elements, markdown: '#' }] }] }],
  });

  // The real element from `horse barn builder austin`: Google Business Profile citations alongside
  // the builders' own domains. This is the block the hand check photographed.
  it('spots Google Business Profile citations', () => {
    const raw = overview([
      { title: 'Local Horse Barn Builders', references: [
        { domain: 'barnsacrosstexas.com' }, { domain: 'www.google.com' },
      ] },
    ]);
    expect(aiOverviewCitesLocalBusinesses(raw)).toBe(true);
    expect(hasLocalCompetitionAbove({ packSize: 0, raw })).toBe(true);
  });

  // ⚠️ The title is a SECONDARY signal — one wording change from silently returning false. The
  // references are what must exist for the citation to work at all.
  it('still catches it when only the title says local', () => {
    expect(aiOverviewCitesLocalBusinesses(overview([{ title: 'Local pros near you', references: [] }]))).toBe(true);
  });

  it('does not fire on an overview that cites only editorial sources', () => {
    const raw = overview([
      { title: 'Comparison of Barn Types', references: [{ domain: 'thisoldhouse.com' }, { domain: 'wikipedia.org' }] },
    ]);
    expect(aiOverviewCitesLocalBusinesses(raw)).toBe(false);
    expect(hasLocalCompetitionAbove({ packSize: 0, raw })).toBe(false);
  });

  it('returns unknown — not false — when the overview was never fetched', () => {
    const raw = { tasks: [{ result: [{ items: [{ type: 'ai_overview', asynchronous_ai_overview: true, items: null, markdown: null }] }] }] };
    // ⚠️ null is the honest answer. Reading it as "no local competition" is exactly the bug.
    expect(hasLocalCompetitionAbove({ packSize: 0, raw })).toBeNull();
  });

  it('never lets an overview override a pack that was actually found', () => {
    const raw = overview([{ title: 'Comparison', references: [] }]);
    expect(hasLocalCompetitionAbove({ packSize: 3, raw })).toBe(true);
  });
});

describe('the flag is not the evidence — the missing contents are', () => {
  // ⚠️ REGRESSION. `asynchronous_ai_overview` stays true even when the contents WERE fetched: it
  // records how Google loaded the overview, not whether we got it. Treating the flag as proof of
  // blindness would discard every reading taken after `load_async_ai_overview` was enabled — the
  // first such run returned 4 populated elements with the flag still true.
  const fetched = {
    tasks: [{ result: [{ items: [{
      type: 'ai_overview', asynchronous_ai_overview: true,
      items: [{ type: 'ai_overview_element', title: 'Local Horse Barn Builders' }], markdown: '# x',
    }] }] }],
  };

  it('trusts a populated overview even with the async flag set', () => {
    expect(hasUnfetchedAiOverview(fetched)).toBe(false);
    expect(packFreeClaimIsVerifiable({ packSize: 0, raw: fetched })).toBe(true);
  });

  it('still catches the genuinely empty placeholder', () => {
    const blind = { tasks: [{ result: [{ items: [{ type: 'ai_overview', asynchronous_ai_overview: true, items: null, markdown: null }] }] }] };
    expect(hasUnfetchedAiOverview(blind)).toBe(true);
  });

  it('treats an empty items array as no contents, not as contents', () => {
    const empty = { tasks: [{ result: [{ items: [{ type: 'ai_overview', items: [], markdown: '' }] }] }] };
    expect(hasUnfetchedAiOverview(empty)).toBe(true);
  });
});
