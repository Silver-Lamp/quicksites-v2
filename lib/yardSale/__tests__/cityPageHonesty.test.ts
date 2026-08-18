// lib/yardSale/__tests__/cityPageHonesty.test.ts
//
// ⚠️ THE ONE PRODUCT RULE THESE PAGES CAN BREAK WITHOUT ANYTHING ERRORING.
//
// A city page is a marketing surface, and the temptation on a marketing surface is to promise the
// thing the visitor wants: shoppers. The directory has ZERO sales. A seller who reads "more buyers
// will find you" and gets none has been mis-sold — and in a hyperlocal market that seller is also
// the only distribution there is, so they tell their neighbours. This cannot be caught by a type
// checker or a render test; the page works perfectly while making the promise.
//
// Comments are stripped first: this file's own reasoning names the forbidden phrases, and so does
// the page's. Without stripping, the rule would fail on its own explanation.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'app/list-your-sale/[city]/page.tsx'), 'utf8');
const shipped = src
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

// JSX wraps prose across lines, so a phrase can be split by a newline and indentation while
// reading as one sentence in the browser. Match on collapsed whitespace — the rule is about the
// words, not about where the formatter broke them. (The first run of this test failed on exactly
// that, and the fix is here rather than reformatting the page to suit the test.)
const flat = shipped.replace(/\s+/g, ' ');

describe('city pages never promise shoppers', () => {
  it('scans a real, non-empty file', () => {
    expect(shipped.length).toBeGreaterThan(500);
  });

  it.each([
    'more shoppers', 'more buyers', 'more customers',
    'near me', 'crowds', 'foot traffic', 'get found by',
  ])('does not contain %p', (phrase) => {
    expect(flat.toLowerCase()).not.toContain(phrase);
  });

  // The counterweight: it must actively SAY what it does not do. Silence is not honesty here —
  // a seller assumes a listing site sends buyers unless told otherwise.
  it('states plainly that no crowd is promised', () => {
    expect(flat).toMatch(/not going to promise you a crowd/);
  });

  it('targets seller intent in the heading, not buyer intent', () => {
    expect(flat).toMatch(/List your yard sale in/);
  });

  it('offers the terms that make the offer real', () => {
    expect(flat).toMatch(/no sticker, no account, no fee/);
  });
});
