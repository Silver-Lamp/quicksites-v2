/**
 * @jest-environment node
 */
// lib/outreach/__tests__/buildIndustry.test.ts
//
// ⚠️ Guards the one decision that decides whether a real business gets a MENU on its website.
//
// buildDraftFromListing resolves `input.industryKey ?? typeToIndustryKey(listing.categories)`, and
// that guess defaults to 'restaurant'. So any caller that omits an industry it already knows is one
// step from building a food site — menu block, order bar — under a towing company's name. That has
// now happened twice: once through a space-vs-underscore mismatch in the type table, and once
// through the build route simply not passing `p.industry_key`. Both were silent, because defaulting
// to restaurant is indistinguishable from correctly detecting a restaurant.
import { readFileSync } from 'fs';
import { join } from 'path';
import { typeToIndustryKey } from '@/lib/places/typeToIndustry';

const BUILD_ROUTE = readFileSync(join(process.cwd(), 'app/api/admin/prospects/build/route.ts'), 'utf8');

describe('the build route uses the industry it already has', () => {
  it('passes industryKey into buildDraftFromListing', () => {
    // A source guard: no unit test can catch this being dropped, because the result is a
    // perfectly valid site — of the wrong kind. Reading the file can.
    const call = BUILD_ROUTE.slice(
      BUILD_ROUTE.indexOf('buildDraftFromListing('),
      BUILD_ROUTE.indexOf('buildDraftFromListing(') + 400,
    );
    expect(call).toMatch(/industryKey\s*:/);
    expect(call).toMatch(/industry_key/);
  });

  it('the guard is not inert — it would notice the call losing the argument', () => {
    const withoutIt = 'const built = await buildDraftFromListing({ listing, operatorId: operator.id });';
    expect(/industryKey\s*:/.test(withoutIt)).toBe(false);
  });
});

describe('why omitting it is dangerous rather than merely untidy', () => {
  it('the category guess falls back to restaurant when it recognises nothing', () => {
    // This is the whole hazard in one line: an unknown trade becomes a food site.
    expect(typeToIndustryKey([])).toBe('restaurant');
    expect(typeToIndustryKey(null)).toBe('restaurant');
    expect(typeToIndustryKey(['point_of_interest', 'establishment'])).toBe('restaurant');
  });

  it('an explicit fallback can opt out of that default', () => {
    expect(typeToIndustryKey([], 'towing' as any)).toBe('towing');
  });
});
