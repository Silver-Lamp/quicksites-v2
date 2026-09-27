// lib/outreach/__tests__/prospectPlaceSignals.test.ts
//
// THE SEARCH RESPONSE'S RATING MUST REACH THE ROW.
//
// `PLACES_FIELD_MASK` requests `places.rating` + `places.userRatingCount` deliberately, at a
// pricier Places SKU. For the life of the sweep those two numbers were fetched, billed, and
// dropped: `ProspectInput` had no field for them, so `runSweep` never carried them and the
// `outreach_prospects.rating` / `review_count` columns stayed null unless the separately-billed
// `backfillPlaceSignals` Place Details call ran — and that is flag-gated off by default.
//
// The cost of the bug was a silent wrong answer, not an error: the forward-to recommender saw
// three towing markets with no ratings, ranked their candidates into exact ties, and would have
// picked South Hill's forward-to by coin flip. With ratings restored the winner is Too Cool
// Towing on 4.8★ from 201 reviews — a different business from the one the tie was about to hand
// it to.
//
// These are source guards: the defect is invisible to `tsc` (every field was optional) and to
// any test that does not compare the mask against the write path.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/test/stripComments';

const ROOT = join(__dirname, '../../..');
const read = (p: string) => stripComments(readFileSync(join(ROOT, p), 'utf8'));

describe('the paid fields are requested', () => {
  const mask = read('lib/places/searchNearby.ts');
  it('still asks Places for rating and userRatingCount', () => {
    expect(mask).toContain('places.rating');
    expect(mask).toContain('places.userRatingCount');
  });
});

describe('and they reach the prospect row', () => {
  const prospects = read('lib/outreach/prospects.ts');
  const sweep = read('lib/prospects/runSweep.ts');

  it('ProspectInput carries them', () => {
    expect(prospects).toMatch(/rating\?:\s*number\s*\|\s*null/);
    expect(prospects).toMatch(/reviewCount\?:\s*number\s*\|\s*null/);
  });

  it('toRow writes both columns', () => {
    expect(prospects).toMatch(/rating:\s*p\.rating/);
    expect(prospects).toMatch(/review_count:\s*p\.reviewCount/);
  });

  it('runSweep copies them off the search result', () => {
    expect(sweep).toMatch(/rating:\s*b\.rating/);
    expect(sweep).toMatch(/reviewCount:\s*b\.reviewCount/);
  });
});

describe('dedupe does not strand a row without a rating', () => {
  const prospects = read('lib/outreach/prospects.ts');
  const sweep = read('lib/prospects/runSweep.ts');

  it('runSweep fills the gap after the upsert', () => {
    // upsertProspects uses ignoreDuplicates, so a row created before ratings were stored can
    // never acquire one from a re-sweep without this step.
    expect(sweep).toContain('fillMissingPlaceSignals');
  });

  it('the fill is gap-only — it never overwrites an existing rating', () => {
    const fn = prospects.slice(prospects.indexOf('export async function fillMissingPlaceSignals'));
    expect(fn).toMatch(/\.is\(\s*'rating',\s*null\s*\)/);
  });
});
