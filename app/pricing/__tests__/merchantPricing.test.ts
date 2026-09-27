/**
 * @jest-environment node
 *
 * /pricing IS WHAT A MERCHANT PAYS. NOTHING ABOUT COMMISSIONS.
 *
 * The homepage was cut to a single audience on 2026-09-25 (#1032/#1033, pinned by
 * `components/home/__tests__/merchantHomepage.test.ts`), but `/pricing` kept a fifth path —
 * "Resell under my brand", 80% lifetime residual — in the path chooser, a full section, and a
 * FAQ. So a business owner who clicked through from a trimmed homepage to find out what
 * QuickSites costs was pitched the channel compensation plan anyway. The split was one click
 * deep. `docs/AUDIENCE_SPLIT_PLAN.md` §4 is explicit: `/pricing` → "what a merchant pays.
 * Nothing about commissions."
 *
 * Removed 2026-09-27: the `#partner` section, its path-chooser card (5 → 4), the
 * "How do partners make money?" FAQ, the hero's "or reselling under your brand", and a LOCAL
 * `PARTNER_FEE_SHARE = 0.8` that duplicated `lib/commerce/partner-terms` and could drift from it
 * silently. One footer line still points at /partners and states no rate.
 *
 * ⚠️ READS CODE, NEVER PROSE. The header comment in `page.tsx` names every forbidden word,
 * because a note explaining a rule has to state the rule — so a naive grep fails on the comment
 * documenting the fix. That exact trap fired repeatedly in this repo. Comments are stripped
 * first, and a test below asserts the stripper still returns something, since a stripper that
 * removed everything would make all of this pass on an empty string.
 *
 * ⚠️ This does NOT forbid linking to /partners. A channel partner who is looking should find it.
 * It forbids SELLING it here — the rate, the residual, the share.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { stripComments } from '@/test/stripComments';

const root = process.cwd();
const read = (p: string) => stripComments(readFileSync(join(root, p), 'utf8'));

const PRICING = read('app/pricing/page.tsx');
const CHOOSER = read('components/pricing/path-chooser.tsx');

describe('the comment stripper is doing its job', () => {
  it('leaves real code behind', () => {
    // Without this, every assertion below would pass on an empty string.
    expect(PRICING.length).toBeGreaterThan(5_000);
    expect(PRICING).toContain('PricingPage');
    expect(CHOOSER).toContain('PRICING_PATHS');
  });
});

describe('no commission pitch on /pricing', () => {
  // The words that only ever appear when we are selling the channel, not the product.
  const FORBIDDEN = [
    'residual',
    'downline',
    'lifetime override',
    'Resell under my brand',
    'White-label and earn',
  ];

  it.each(FORBIDDEN)('does not say %p', (word) => {
    expect(PRICING.toLowerCase()).not.toContain(word.toLowerCase());
    expect(CHOOSER.toLowerCase()).not.toContain(word.toLowerCase());
  });

  it('does not restate the partner fee share', () => {
    // A merchant page quoting "80% of every fee" is quoting someone else's income.
    expect(PRICING).not.toMatch(/\b80\s*%/);
    expect(CHOOSER).not.toMatch(/\b80\s*%/);
  });

  it('does not re-declare PARTNER_FEE_SHARE locally', () => {
    // It had its own `const PARTNER_FEE_SHARE = 0.8` beside the imported fee percentages, free
    // to drift from lib/commerce/partner-terms without anything noticing.
    expect(PRICING).not.toMatch(/const\s+PARTNER_FEE_SHARE/);
  });

  it('has no #partner path section', () => {
    expect(PRICING).not.toContain('id="partner"');
    expect(CHOOSER).not.toContain("hash: '#partner'");
  });
});

describe('what /pricing must keep', () => {
  it('still prices the merchant paths', () => {
    expect(PRICING).toContain('id="merchant"');
    expect(PRICING).toContain('id="leadgen"');
    expect(PRICING).toContain('id="agency"');
    expect(PRICING).toContain('id="done-for-you"');
  });

  it('still links to /partners without selling it', () => {
    // Removing the pitch must not orphan the channel: a partner who is looking still gets there.
    expect(PRICING).toContain('partnersHref');
  });
});
