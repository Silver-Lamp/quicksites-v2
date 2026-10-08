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

describe('/for-amber promises nothing', () => {
  it.each([
    [/\$\s?\d/, 'a dollar figure'],
    [/\d+(\.\d+)?\s?%/, 'a percentage'],
    [/\b\d+\s?(meals|orders|customers|hours|cooks|dollars|per)\b/i, 'a volume or rate'],
    [/\b(you(?:'ll| will) (earn|make|get)|guaranteed?|income of|projected|estimate)\b/i, 'an earnings promise'],
    [/\b(she|amber) (has )?agreed\b/i, 'an implied agreement'],
    [/\bcommission of\b|\bfinder'?s fee\b/i, 'a fee quoted as a thing'],
  ])('never contains %s — %s', (re) => {
    expect(withoutLodgeFacts).not.toMatch(re);
  });

  it('carries no digits at all beyond the lodge’s public contact details and layout classes', () => {
    // Everything a reader sees is JSX text; class strings, import paths and the tone tables are
    // quoted code. Strip the quoted code, keep the prose.
    const prose = withoutLodgeFacts
      .replace(/className="[^"]*"/g, '')
      .replace(/className=\{`[^`]*`\}/g, '')
      .replace(/'[^'\n]*'/g, '')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/<\/?[a-z][a-z0-9]*/g, '') // tag names: h1, h2
      .replace(/\{[^{}]*\}/g, ''); // JSX expressions: {EAGLES.quote2}
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

  it('the QuickSites section is separate, carries her live code, and states the zero-paid fact without a rate', () => {
    expect(page).toMatch(/const REF_CODE = 'amber'/);
    expect(page).toMatch(/nothing to do with the kitchen/);
    expect(page).toMatch(/nobody has been paid a referral\s+commission yet/);
    expect(page).toMatch(/exact share is written on your\s+own dashboard/);
  });

  it('keeps the two roles apart and names the first step as a question, not a commitment', () => {
    expect(page).toMatch(/The introducer/);
    expect(page).toMatch(/The operator/);
    expect(page).toMatch(/which is not a commitment/);
  });
});
