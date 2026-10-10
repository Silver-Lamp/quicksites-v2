/**
 * @jest-environment node
 */
// lib/outreach/__tests__/evolvePostcard.test.ts
//
// A postcard to a stranger under a real business's name. Same rules as the claim card, grepped
// over the RENDERED HTML; plus the two things only this card can get wrong: it must point at
// the tracked Evolve link, and it must never be built for a draft without a menu.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/test/stripComments';
import { renderEvolvePostcardFront, renderEvolvePostcardBack, trackedEvolveUrl, EVOLVE_CARD_BENEFITS, type EvolvePostcardModel } from '@/lib/outreach/evolvePostcard';

const read = (p: string) => stripComments(readFileSync(join(process.cwd(), p), 'utf8'));

const MODEL: EvolvePostcardModel = {
  businessName: 'The Rock Island Pizza',
  city: 'Vashon',
  region: 'WA',
  currentHost: 'pizzarockisland.com',
  evolveLinkUrl: trackedEvolveUrl('11111111-1111-1111-1111-111111111111', 'https://www.quicksites.ai'),
  qrDataUrl: 'data:image/png;base64,QR',
  benefits: [...EVOLVE_CARD_BENEFITS],
  sender: { name: 'Sandon', title: 'QuickSites', email: 'hello@example.com', headshotUrl: null, signatureUrl: null, bookingUrl: null } as any,
  brandName: null,
  localLine: 'Local to you — Vashon, WA',
  contactEmail: 'hello@example.com',
};

const FORBIDDEN: Array<[RegExp, string]> = [
  [/\brank(s|ing|ed)?\b/i, 'a ranking claim'],
  [/page one|page 1|#1\b/i, 'a page-one claim'],
  [/\bgoogle\b/i, 'a search-engine claim'],
  [/24\s*\/\s*7/i, 'an availability claim about the business'],
  [/licens|insured/i, 'a regulatory claim about the business'],
  [/guarantee/i, 'a guarantee'],
  [/competitor|before someone else|goes to one|whoever lets them/i, 'the competition mechanic'],
  [/claim by|deadline|expires|only \d+ (days|left)/i, 'invented urgency'],
  [/\$\s?\d/, 'a printed price'],
  [/\d\s?%/, 'a printed percentage'],
  [/more (customers|orders|sales)|grow your|double|boost/i, 'a results promise'],
];

function stripTags(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
}

describe('the card prints no promise it cannot keep', () => {
  const text = stripTags(renderEvolvePostcardFront(MODEL)) + '\n' + stripTags(renderEvolvePostcardBack(MODEL));
  it.each(FORBIDDEN)('never prints %s — %s', (re) => {
    expect(text).not.toMatch(re);
  });
  it('states the exit and a human to reach, on both sides', () => {
    for (const html of [renderEvolvePostcardFront(MODEL), renderEvolvePostcardBack(MODEL)]) {
      expect(html).toMatch(/Say the word and it’s gone/);
      expect(html).toContain('hello@example.com');
    }
  });
  it('says the site stays, the prices are confirmed by the owner, and nothing is charged by trying', () => {
    expect(text).toMatch(/Your site stays as it is/);
    expect(text).toMatch(/you confirm the prices/i);
    expect(text).toMatch(/nothing is charged/i);
  });
});

describe('the link and the QR', () => {
  it('the QR and the printed link are the tracked /go/ link with to=evolve — counted, then the Evolve page', () => {
    expect(MODEL.evolveLinkUrl).toBe('https://www.quicksites.ai/go/11111111-1111-1111-1111-111111111111?to=evolve');
    expect(renderEvolvePostcardBack(MODEL)).toContain(MODEL.evolveLinkUrl);
    expect(renderEvolvePostcardFront(MODEL)).toContain(MODEL.qrDataUrl);
  });
  it('/go honours to=evolve only for an unclaimed listing draft, and carries ref', () => {
    const go = read('app/go/[prospectId]/route.ts');
    expect(go).toMatch(/sp\.get\('to'\) === 'evolve'/);
    expect(go).toMatch(/toEvolve && \(t as any\)\.claim_source === 'listing_import'/);
    expect(go).toMatch(/\/evolve\/\$\{prospectId\}\$\{refQs\}/);
  });
});

describe('layout — positioned edges, like the claim card (Lob ignores flex spacers)', () => {
  it('the QR column and the fine print are absolutely positioned', () => {
    const front = renderEvolvePostcardFront(MODEL);
    expect(front).toMatch(/\.qrwrap \{ position:absolute/);
    expect(front).toMatch(/\.fine \{ position:absolute/);
    expect(renderEvolvePostcardBack(MODEL)).toMatch(/\.sender \{ position:absolute/);
  });
  it('a long name scales the headline instead of overflowing', () => {
    expect(renderEvolvePostcardFront({ ...MODEL, businessName: 'The Vashon Island Coffee Roasterie and Bakery' })).toMatch(/class="card long"/);
    expect(renderEvolvePostcardFront(MODEL)).toMatch(/class="card"/);
  });
});

describe('who may be mailed', () => {
  it('the selector blocks a draft with no menu, an operational claim, a non-food row, or no address; only no-ordering / shop / app-only platforms qualify', () => {
    const src = read('lib/outreach/evolvePostcardSend.ts');
    expect(src).toMatch(/!draftHasMenu\(t\.data\)\) item\.blocked = 'no_menu'/);
    expect(src).toMatch(/draftHasOperationalClaims\(t\.data\)\) item\.blocked = 'operational_claims'/);
    expect(src).toMatch(/!looksLikeFoodBusiness\(p\.categories\)\) item\.blocked = 'not_food'/);
    expect(src).toMatch(/\.is\('postcard_sent_at', null\)/);
    expect(src).toMatch(/EVOLVE_ELIGIBLE_PLATFORMS[^=]*= new Set\(\['none', \.\.\.SHOP, \.\.\.THIRD_PARTY\]\)/);
    // The page the card points at must answer before a card is printed.
    expect(src).toMatch(/preflightSiteUrl\(d\.evolveUrl\)/);
    // Idempotent per prospect; a test send never marks a prospect mailed.
    expect(src).toMatch(/idempotencyKey: opts\.test \? `test_evolve_\$\{p\.id\}_\$\{Date\.now\(\)\}` : `evolve_\$\{p\.id\}`/);
    expect(src).toMatch(/if \(!opts\.test\) mailedIds\.push\(p\.id\)/);
  });
});
