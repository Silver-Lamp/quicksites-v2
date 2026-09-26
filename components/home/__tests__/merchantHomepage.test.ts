/**
 * @jest-environment node
 *
 * THE MERCHANT HOMEPAGE SELLS ONE THING.
 *
 * On 2026-09-25 three sections were deleted from the homepage — "White-label it. Resell it. Earn
 * the slice.", "Grow the network. Earn on all of it." (recruit link / downline / lifetime override)
 * and "We power the platform. You resell it as your own." Together they were ~45% of the page body
 * and they CLOSED it, so the last thing a business owner read on quicksites.ai was our channel
 * compensation plan. See docs/AUDIENCE_SPLIT_PLAN.md.
 *
 * Nothing in TypeScript objects to putting them back. A section is just JSX, and the pressure to
 * re-add one ("partners need a link too") is perfectly reasonable each time it comes up. This test
 * is the thing that says no.
 *
 * ⚠️ IT READS CODE, NEVER PROSE, AND THAT IS NOT A DETAIL. The deletion note left in
 * home-client.tsx names every forbidden word, because a note explaining a rule has to state the
 * rule. A naive grep therefore fails on the comment that documents the fix — which happened three
 * separate times in this repo in one day. Comments are stripped before anything is matched, and
 * there is a test below asserting the stripper actually works, because a stripper that quietly
 * removed everything would make all of this pass on an empty string.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
// ⚠️ Shared, not local. The same mistake recurred twice more the same afternoon while wiring the
// guest funnel, so the stripper lives in one place with the reasoning attached.
import { stripComments } from '@/test/stripComments';

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const HOME = stripComments(read('components/home/home-client.tsx'));
const HEADER = stripComments(read('components/site/site-header.tsx'));

/**
 * Words that address someone who would RESELL the product, not someone who would use it.
 * "commission", "residual" and "take-rate" are included: a merchant does not take a rate, and a
 * card telling them they do was on this page for months inside the commerce section.
 */
const RESELLER_VOCABULARY = [
  'downline',
  'recruit link',
  'lifetime override',
  'become a hub',
  'become a partner',
  'become a reseller',
  'residual commission',
  'commission ledger',
  'take-rate',
  'your take-rate',
];

describe('the comment stripper', () => {
  it('leaves the shipped code substantial', () => {
    // A stripper that ate the file would make every assertion below vacuously true.
    expect(HOME.length).toBeGreaterThan(4000);
    expect(HEADER.length).toBeGreaterThan(2000);
  });

  it('removes a JSX comment but keeps the code around it', () => {
    const out = stripComments('<a/>\n{/* downline */}\n<b/>');
    expect(out).not.toMatch(/downline/);
    expect(out).toMatch(/<a\/>/);
    expect(out).toMatch(/<b\/>/);
  });

  it('actually had something to remove in home-client (the deletion note names these words)', () => {
    const raw = read('components/home/home-client.tsx');
    expect(raw).toMatch(/downline/); // present in prose…
    expect(HOME).not.toMatch(/downline/); // …and gone from code.
  });
});

describe('the homepage does not sell the channel', () => {
  it.each(RESELLER_VOCABULARY)('never renders %p', (phrase) => {
    expect(HOME.toLowerCase()).not.toContain(phrase.toLowerCase());
  });

  it('still sells the product — the merchant sections are intact', () => {
    expect(HOME).toContain('Commerce, built in');
    expect(HOME).toContain('A CRM that fills itself');
    expect(HOME).toContain('Starts as your industry');
  });

  it('links to /partners exactly once, from the footer', () => {
    const hits = HOME.match(/["']\/partners["']/g) ?? [];
    expect(hits).toHaveLength(1);
  });

  it('takes no resellerSlot — the diagram lives on /partners now', () => {
    expect(HOME).not.toMatch(/resellerSlot\s*[,:}]/);
  });
});

describe('the nav puts one audience first', () => {
  it('has no top-level Partners link', () => {
    // It belongs in the footers. A channel partner who is looking will find it; a merchant on
    // their way to the pricing page should not be sold it.
    expect(HEADER).not.toMatch(/label:\s*'Partners'/);
  });

  it('keeps every vertical reachable, grouped rather than deleted', () => {
    for (const href of [
      '/restaurants',
      '/realtors',
      '/secondset',
      '/verbatim',
      '/lemonade-stands',
      '/supplements',
    ]) {
      expect(HEADER).toContain(`'${href}'`);
    }
  });

  // ⚠️ THE REGRESSION THIS EXISTS TO CATCH IS INVISIBLE IN THE SOURCE AND IN THE BROWSER.
  // Grouping the verticals under a dropdown removed a site-wide internal link to each of them.
  // With the panel mounted only when open (`{open && <div>}`), the served HTML contains no anchor
  // to /restaurants, /supplements or /verbatim from ANY page — the menu looks perfect to a person
  // clicking it, and a crawler sees nothing. Found by curl-ing the built page, not by reading the
  // component. The same failure is already recorded in DEFAULT_LINKS about Verbatim: reachable
  // from nowhere, while its usage was being read as weak demand.
  it('renders the dropdown links into the document, hidden — never mounts them on open', () => {
    expect(HEADER).toMatch(/hidden=\{!open\}/);
    // The panel must not be behind a mount guard. (`open &&` on a className is fine.)
    expect(HEADER).not.toMatch(/\{open && \(/);
  });

  it('keeps the top level short', () => {
    // The flat list reached eleven and overflowed the page between 768px and ~805px. The point of
    // the dropdown is that adding a vertical stops costing header width — so if this ever fails,
    // the fix is almost certainly to nest the new item, not to raise the number.
    const topLevel = HEADER.match(/^\s{2}\{\s*label:/gm) ?? [];
    expect(topLevel.length).toBeLessThanOrEqual(6);
  });
});

describe('/supplements promises only what commerce actually does', () => {
  const PAGE = stripComments(read('app/supplements/page.tsx'));

  // ⚠️ `stripeAdapter` opens Checkout with `mode: 'payment'`. Subscribe-and-save is close to table
  // stakes for a supplement brand, which is exactly why the page must not imply it — and why the
  // day someone adds recurring billing, this test should be the thing that reminds them to update
  // the copy rather than leaving a page that now understates the product.
  // ⚠️ THE FIRST VERSION OF THIS FORBADE THE PHRASE "subscribe-and-save" OUTRIGHT, AND FAILED —
  // on the sentence that says we do not have it. A ban on a token cannot tell a claim from its
  // denial, which is the same shape as a source guard tripping over the comment that explains it.
  // So: forbid the AFFIRMATIVE constructions, and separately require the denial to still be there.
  it('never claims to offer subscriptions', () => {
    for (const claim of [
      /(?:offers?|with|includes?|supports?|get|built-in)\s+subscribe[- ]and[- ]save/i,
      /subscribe[- ]and[- ]save\s+(?:is\s+)?(?:available|included|built[- ]in|supported)/i,
      /recurring billing (?:available|included|supported)/i,
      /sell subscriptions/i,
    ]) {
      expect(PAGE).not.toMatch(claim);
    }
  });

  it('says out loud that subscriptions are missing', () => {
    expect(PAGE).toMatch(/No subscriptions yet/);
    expect(PAGE).toMatch(/There is no subscribe-and-save/);
  });

  it('does not promise carrier-rated shipping', () => {
    expect(PAGE).not.toMatch(/live (usps|ups|fedex) rates/i);
    expect(PAGE).not.toMatch(/real-?time shipping rates/i);
  });

  it('keeps the no-health-claims commitment on the page', () => {
    expect(PAGE).toMatch(/don&apos;t write health claims/);
  });

  it('sells to a merchant, not a reseller', () => {
    for (const phrase of RESELLER_VOCABULARY) {
      expect(PAGE.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });
});
