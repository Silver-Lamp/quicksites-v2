/**
 * @jest-environment node
 */
// lib/starterKit/__tests__/starterKit.test.ts
//
// Paper cannot be caveated after it is handed over, so the starter kit is held to the claim
// postcard's forbidden list, and every sentence it can print lives in COPY so this test reads
// them all.
import fs from 'node:fs';
import path from 'node:path';
import { buildStarterKit, COPY, repNameFromLabel, territoryFromLabel, printablePhone, printedUrl } from '@/lib/starterKit/starterKit';
import { stripComments } from '@/test/stripComments';

/** Same list as lib/outreach/__tests__/claimPostcard.test.ts — a card is a card. */
const FORBIDDEN: Array<[RegExp, string]> = [
  [/\brank(s|ing|ed)?\b/i, 'a ranking claim'],
  [/page one|page 1|#1\b/i, 'a page-one claim'],
  [/\bgoogle\b/i, 'a search-engine claim'],
  [/24\s*\/\s*7/i, 'an availability claim about the business'],
  [/licens|insured/i, 'a regulatory claim about the business'],
  [/guarantee/i, 'a guarantee'],
  [/competitor|before someone else|goes to one/i, 'the competition mechanic'],
  [/claim by|deadline|expires|only \d+ (days|left)/i, 'invented urgency'],
  [/\$\s?\d/, 'a printed price'],
];

function allCopy(): string {
  const parts: string[] = [];
  for (const v of Object.values(COPY)) {
    if (typeof v === 'string') parts.push(v);
    else if (Array.isArray(v)) parts.push(...v);
    else if (typeof v === 'function') parts.push(v("Durong"));
  }
  return parts.join('\n');
}

describe('the kit prints no promise a postcard may not make', () => {
  const text = allCopy();
  it.each(FORBIDDEN)('never prints %s — %s', (re) => {
    expect(text).not.toMatch(re);
  });
  it('the page itself carries no literal price or search-engine claim either', () => {
    const page = stripComments(fs.readFileSync(path.join(process.cwd(), 'app/starter-kit/[code]/page.tsx'), 'utf8'));
    for (const [re] of FORBIDDEN) expect(page).not.toMatch(re);
    expect(page).toMatch(/robots: \{ index: false, follow: false \}/);
  });
});

describe('the rep', () => {
  it('takes the name from the code label and the territory from its suffix', () => {
    expect(repNameFromLabel('Abdou (Vashon Island)', 'abdou')).toBe('Abdou');
    expect(territoryFromLabel('Abdou (Vashon Island)')).toBe('Vashon Island');
    expect(repNameFromLabel(null, 'abdou')).toBe('abdou');
    expect(territoryFromLabel('Ryan')).toBeNull();
  });
  it('prints a phone only when it looks like one', () => {
    expect(printablePhone('907-560-3123')).toBe('(907) 560-3123');
    expect(printablePhone('1 (907) 560 3123')).toBe('(907) 560-3123');
    expect(printablePhone('call me')).toBeNull();
    expect(printablePhone('')).toBeNull();
  });
});

describe('buildStarterKit', () => {
  const kit = buildStarterKit({
    code: 'abdou',
    label: 'Abdou (Vashon Island)',
    phone: '9075603123',
    drafts: [{ prospectId: 'p1', businessName: 'Durong', previewUrl: 'https://deliveredmenu.com/durong-ip8ay', needsMenu: true }],
    baseUrl: 'https://www.quicksites.ai',
  });
  it('keys every link to the code and tracks the claim through /go/', () => {
    expect(kit.refUrl).toBe('https://www.quicksites.ai/?ref=abdou');
    expect(kit.refUrlPrinted).toBe('quicksites.ai/?ref=abdou');
    expect(kit.drafts[0].claimUrl).toBe('https://www.quicksites.ai/go/p1');
    expect(kit.rep).toEqual({ code: 'abdou', name: 'Abdou', phone: '(907) 560-3123', territory: 'Vashon Island' });
  });
  it('a draft with no menu says so rather than implying one', () => {
    expect(kit.drafts[0].needsMenu).toBe(true);
    expect(COPY.draftNeedsMenu).toMatch(/not on it yet/);
  });
  it('printedUrl drops scheme and www for the human-typed line', () => {
    expect(printedUrl('https://www.quicksites.ai/?ref=abdou')).toBe('quicksites.ai/?ref=abdou');
  });
});
