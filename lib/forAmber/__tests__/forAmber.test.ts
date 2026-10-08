/**
 * @jest-environment node
 */
// lib/forAmber/__tests__/forAmber.test.ts
//
// /for-amber is addressed to a named neighbour about money that does not exist yet. PorchHearth's
// brief (crosstalk 2026-10-08): no figure, no projection, no range, no surname, nothing she did
// not say, no implication she agreed. This reads the page and fails on any of them.
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/test/stripComments';

const page = stripComments(fs.readFileSync(path.join(process.cwd(), 'app/for-amber/page.tsx'), 'utf8'));
// The lodge's own public contact details are the only digits allowed on the page.
const withoutLodgeFacts = page
  .replace(/18134 Vashon Hwy SW/g, '')
  .replace(/\(206\) 463-5477/g, '')
  .replace(/eagles3144@gmail\.com/g, '')
  .replace(/vashoneagles3144\.com/g, '')
  .replace(/Aerie 3144/g, '');

// The page has two subjects. The KITCHEN half (money that does not exist) stays figure-free; the
// QUICKSITES section (owner, 2026-10-08) may state the real referral rate, derived from REF_RATE.
const QS_START = withoutLodgeFacts.indexOf('A separate thing, because you know half the island');
const QS_END = withoutLodgeFacts.indexOf("What's real and what isn't, side by side");
const quicksitesSection = withoutLodgeFacts.slice(QS_START, QS_END);
const kitchenPart = withoutLodgeFacts.slice(0, QS_START) + withoutLodgeFacts.slice(QS_END);

describe('/for-amber promises nothing about the kitchen', () => {
  it('has both halves where the test expects them', () => {
    expect(QS_START).toBeGreaterThan(0);
    expect(QS_END).toBeGreaterThan(QS_START);
  });

  it.each([
    [/\$\s?\d/, 'a dollar figure'],
    [/\b(you(?:'ll| will) (earn|make|get)|guaranteed?|income of|projected|estimate)\b/i, 'an earnings promise'],
    [/\b(she|amber) (has )?agreed\b/i, 'an implied agreement'],
    [/\bcommission of\b|\bfinder'?s fee\b/i, 'a fee quoted as a thing'],
  ])('never contains %s anywhere — %s', (re) => {
    expect(withoutLodgeFacts).not.toMatch(re);
  });

  it.each([
    [/\d+(\.\d+)?\s?%/, 'a percentage'],
    [/\b\d+\s?(meals|orders|customers|hours|cooks|dollars|per)\b/i, 'a volume or rate'],
  ])('never contains %s in the kitchen half — %s', (re) => {
    const prose = kitchenPart.replace(/^const [^\n]*$/gm, '');
    expect(prose).not.toMatch(re);
  });

  it('the referral rate appears only in the QuickSites section, derived from REF_RATE, never typed', () => {
    expect(page).toMatch(/const REF_RATE = 0\.35;/);
    expect(quicksitesSection).toMatch(/\{refPct\}%/);
    expect(withoutLodgeFacts).not.toMatch(/\b35\s?%/); // the digits come from the constant, not the copy
  });

  it('the kitchen half carries no digits beyond the lodge’s public contact details and layout classes', () => {
    // Everything a reader sees is JSX text; class strings, import paths, constants and the tone
    // tables are quoted code. Strip the quoted code, keep the prose.
    const prose = kitchenPart
      .replace(/^const [^\n]*$/gm, '')
      .replace(/className="[^"]*"/g, '')
      .replace(/className=\{`[^`]*`\}/g, '')
      .replace(/'[^'\n]*'/g, '')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/<\/?[a-z][a-z0-9]*/g, '') // tag names: h1, h2
      .replace(/\{[^{}]*\}/g, '') // JSX expressions: {EAGLES.quote2}
      .replace(/\b[A-Za-z_]+\d+\b/g, ''); // identifiers with digits: the `quote2` key
    expect(prose).not.toMatch(/\d/);
  });

  it('is first-name only, unlisted, and says plainly that nothing is agreed', () => {
    expect(page).toMatch(/robots: \{ index: false, follow: false \}/);
    expect(page).toMatch(/nothing here is agreed, and no money exists yet/i);
    expect(page).toMatch(/never completed a real order/);
    expect(page).not.toMatch(/Amber [A-Z][a-z]+/); // no surname
    // No contact details for her: with the lodge's own number removed, no phone or email remains.
    expect(withoutLodgeFacts).not.toMatch(/amber@|\(\d{3}\) \d{3}-\d{4}|\b[\w.]+@[\w.]+\.\w+\b/);
  });

  it('the QuickSites section is separate, carries her live code, and states the zero-paid fact', () => {
    expect(page).toMatch(/const REF_CODE = 'amber'/);
    expect(quicksitesSection).toMatch(/nothing to do with the kitchen/);
    expect(quicksitesSection).toMatch(/nobody has been paid a referral\s+commission yet/);
    expect(quicksitesSection).toMatch(/Not a number about the kitchen above/);
  });

  it('keeps the two roles apart and names the first step as a question, not a commitment', () => {
    expect(page).toMatch(/The introducer/);
    expect(page).toMatch(/The operator/);
    expect(page).toMatch(/which is not a commitment/);
  });
});
