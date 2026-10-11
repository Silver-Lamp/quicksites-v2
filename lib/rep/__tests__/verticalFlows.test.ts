// The flowcharts on /for-sales say what a rep does and what comes of it — and nothing a rep may
// not say. Same forbidden list as the claim postcard and the restaurants section.
import fs from 'fs';
import path from 'path';
import { VERTICAL_FLOWS, WHO_LABEL } from '@/lib/rep/verticalFlows';
import { SPLIT } from '@/lib/commerce/rentalSplits';
import { stripComments } from '@/test/stripComments';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

const FORBIDDEN: Array<[RegExp, string]> = [
  [/\brank(s|ing|ed)?\b/i, 'a ranking claim'],
  [/page one|page 1|#1\b/i, 'a page-one claim'],
  [/\bgoogle\b/i, 'a search-engine claim'],
  [/24\s*\/\s*7/i, 'an availability claim'],
  [/licens|insured/i, 'a regulatory claim'],
  [/guarantee/i, 'a guarantee'],
  [/before someone else|goes to one|whoever lets them/i, 'the competition mechanic'],
  [/claim by|deadline|expires|only \d+ (days|left)/i, 'invented urgency'],
  [/\$\s?\d/, 'a typed price'],
  [/more (customers|orders|sales)|grow your|double|boost/i, 'a results promise'],
  [/\b(will|'ll|going to)\b[^.]{0,40}\b(calls|customers|leads)\b/i, 'a volume promise'],
];

function allCopy(): string {
  return Object.values(VERTICAL_FLOWS)
    .flatMap((f) => [f.caption, f.result.title, f.result.detail, ...f.steps.flatMap((s) => [s.title, s.detail])])
    .concat(Object.values(WHO_LABEL))
    .join('\n');
}

describe('the vertical flowcharts promise nothing a rep may not', () => {
  it.each(FORBIDDEN)('never says %s — %s', (re) => {
    expect(allCopy()).not.toMatch(re);
  });
  it('each flow has steps for the rep and a result', () => {
    for (const f of Object.values(VERTICAL_FLOWS)) {
      expect(f.steps.length).toBeGreaterThanOrEqual(3);
      expect(f.steps.some((s) => s.who === 'rep')).toBe(true);
      expect(f.result.title.length).toBeGreaterThan(10);
    }
  });
  it("the rental's result is derived from the split the ledger pays, not typed", () => {
    expect(VERTICAL_FLOWS.rental.result.title).toContain(`${Math.round(SPLIT.closer * 100)}%`);
    const src = read('lib/rep/verticalFlows.ts');
    expect(src).not.toMatch(/50%/);
    expect(src).toMatch(/SPLIT\.closer/);
  });
  it('the website build says plainly that it pays no rep commission', () => {
    expect(VERTICAL_FLOWS.website.result.title).toMatch(/no rep commission/i);
  });
});

describe('/for-sales mounts a flowchart under each remaining vertical', () => {
  const page = read('app/for-sales/page.tsx');
  it('rental flow sits under "The domain rental", website flow after the other-product card', () => {
    const rental = page.indexOf('<VerticalFlow flow="rental"');
    const website = page.indexOf('<VerticalFlow flow="website"');
    expect(rental).toBeGreaterThan(page.indexOf('The domain rental'));
    expect(website).toBeGreaterThan(page.indexOf('The other product'));
    expect(rental).toBeLessThan(website);
    expect(page.indexOf('<RestaurantsSection')).toBeLessThan(rental);
  });
  it('the public table offers a Build link that goes to sign-up when there is no rep grant', () => {
    const table = read('components/for-rep/restaurant-table.tsx');
    expect(table).toMatch(/signUpHref\(/);
    expect(table).toMatch(/Build — sign up/);
  });
});
