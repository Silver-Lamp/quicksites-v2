/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  renderClaimPostcardFront,
  renderClaimPostcardBack,
  trackedDraftClaimUrl,
  printableHost,
  isMailableProspect,
  draftHasOperationalClaims,
  type ClaimPostcardModel,
} from '@/lib/outreach/claimPostcard';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const model: ClaimPostcardModel = {
  businessName: 'Austin Tow Truck',
  city: 'Austin',
  region: 'TX',
  industryKey: 'towing' as any,
  siteUrl: 'https://austin-tow-truck-sj4hx.quicksites.ai',
  claimUrl: 'https://www.quicksites.ai/c/3ae8c8cd',
  qrDataUrl: 'data:image/png;base64,AAAA',
  benefits: ['A real website at your own address — live in minutes', 'Request a quote or call you in one tap', 'Nothing to install, nothing to maintain'],
  sender: { name: 'Sandon', title: 'Founder', email: 'sandon@quicksites.ai', headshotUrl: null, signatureUrl: null },
  brandName: null,
  localLine: null,
  contactEmail: 'sandon@quicksites.ai',
};

/** Every promise a postcard must never make. A card cannot be caveated after it is mailed. */
const FORBIDDEN: Array<[RegExp, string]> = [
  [/\brank(s|ing|ed)?\b/i, 'a ranking claim'],
  [/page one|page 1|#1\b/i, 'a page-one claim'],
  [/\bgoogle\b/i, 'a search-engine claim'],
  [/24\s*\/\s*7/i, 'an availability claim about the business'],
  [/licens|insured/i, 'a regulatory claim about the business'],
  [/guarantee/i, 'a guarantee'],
  [/competitor|before someone else|goes to one/i, 'the competition mechanic — it stays out of the message'],
  [/claim by|deadline|expires|only \d+ (days|left)/i, 'invented urgency'],
  [/\$\s?\d/, 'a printed price — it cannot follow the env'],
];

describe('the claim postcard is the most conservative surface we own', () => {
  const front = renderClaimPostcardFront(model);
  const back = renderClaimPostcardBack(model);

  it.each(FORBIDDEN)('never prints %s — %s', (re) => {
    expect(front).not.toMatch(re as RegExp);
    expect(back).not.toMatch(re as RegExp);
  });

  it('says what it is, where the site is, how to claim it, and how to make it go away', () => {
    expect(front).toContain('We built <b>Austin Tow Truck</b> a website.');
    expect(front).toContain('austin-tow-truck-sj4hx.quicksites.ai');
    expect(front).toContain('data:image/png;base64,AAAA');
    expect(back).toContain('https://www.quicksites.ai/c/3ae8c8cd');
    expect(back).toMatch(/Say the word and it’s gone/);
    expect(back).toContain('sandon@quicksites.ai');
    expect(back).toMatch(/free/i);
  });

  it('describes the source honestly — the public listing, nothing more', () => {
    expect(front).toMatch(/built from your public listing/i);
    expect(back).toMatch(/name, phone, address and hours anyone can already see/);
  });

  it('a branded send signs as the team and still gives a human to reach', () => {
    const branded = renderClaimPostcardBack({ ...model, sender: null, brandName: 'CedarSites', contactEmail: 'help@cedarsites.com' });
    expect(branded).toContain('The CedarSites team');
    expect(branded).toContain('help@cedarsites.com');
  });

  it('with no contact at all the front still states the exit', () => {
    const bare = renderClaimPostcardFront({ ...model, sender: null, contactEmail: null });
    expect(bare).toMatch(/Say the word and it’s gone/);
  });
});

describe('the printed link carries no bearer token', () => {
  it('is the tracked /c/ route, which mints a fresh token on visit', () => {
    expect(trackedDraftClaimUrl('abc', 'https://www.quicksites.ai/')).toBe('https://www.quicksites.ai/c/abc');
    expect(trackedDraftClaimUrl('abc')).not.toMatch(/token=/);
  });
  it('prints hosts without a scheme', () => {
    expect(printableHost('https://x.quicksites.ai/')).toBe('x.quicksites.ai');
  });
});

describe('who a card can go to', () => {
  const base = { status: 'draft_built', template_id: 'tpl', lead_tier: 'no_website', industry_key: 'towing', address: '1 Main St, Austin, TX 78701, USA', postcard_sent_at: null } as const;
  it('a built, unmailed, no-website trade draft with an address', () => {
    expect(isMailableProspect(base)).toBe(true);
  });
  it.each([
    ['already mailed', { ...base, postcard_sent_at: '2026-09-01' }],
    ['not built', { ...base, status: 'discovered', template_id: null }],
    ['a restaurant', { ...base, industry_key: 'restaurant' }],
    ['no address to mail to', { ...base, address: null }],
    ['has a website', { ...base, lead_tier: 'has_site' }],
  ])('never: %s', (_w, p) => {
    expect(isMailableProspect(p as any)).toBe(false);
  });
});

describe('the send gate — an invented promise never reaches a mailbox', () => {
  it('blocks a draft with an operational claim anywhere in its tree', () => {
    expect(draftHasOperationalClaims({ pages: [{ blocks: [{ content: { subheadline: "We're here for you 24/7!" } }] }] })).toBe(true);
    expect(draftHasOperationalClaims({ pages: [{ blocks: [{ content: { items: [{ question: 'Do you offer 24/7 service?', answer: 'Call us and we’ll tell you what we can do today.' }] } }] }] })).toBe(false);
    expect(draftHasOperationalClaims({ pages: [{ blocks: [{ content: { headline: 'Towing in Austin, TX' } }] }] })).toBe(false);
  });
  it('a pricing phrase on a button is an invitation (#906); in an answer it is a commitment', () => {
    expect(draftHasOperationalClaims({ pages: [{ blocks: [{ content: { cta_text: 'Get a Free Quote' } }] }] })).toBe(false);
    expect(draftHasOperationalClaims({ pages: [{ blocks: [{ content: { items: [{ q: 'How much?', a: 'We’ll get back to you with a free, no-obligation quote.' }] } }] }] })).toBe(true);
  });
  it('the printed host never depends on the env that rendered it', () => {
    const saved = process.env.TRADE_SITE_BASE_URL;
    delete process.env.TRADE_SITE_BASE_URL;
    expect(trackedDraftClaimUrl('x')).toBe('https://www.quicksites.ai/c/x');
    process.env.TRADE_SITE_BASE_URL = 'http://delivered.menu'; // not https → ignored
    expect(trackedDraftClaimUrl('x')).toBe('https://www.quicksites.ai/c/x');
    process.env.TRADE_SITE_BASE_URL = saved;
    expect(read('lib/outreach/claimPostcardSend.ts')).not.toMatch(/baseUrl: brand\.baseUrl,/);
  });
});

describe('wiring', () => {
  it('the cron mail step is gated twice and honours the review window', () => {
    const src = read('lib/tradeSites/pipeline.ts');
    expect(src).toMatch(/TRADE_PIPELINE_MAIL_ENABLED/);
    expect(src).toMatch(/minAgeHours: caps\.minAgeHours/);
    expect(read('lib/outreach/claimPostcardSend.ts')).toMatch(/postcardMailEnabled\(\)/);
  });
  it('the admin route and the cron send through the same loop', () => {
    expect(read('app/api/admin/prospects/mail-claim-postcards/route.ts')).toMatch(/sendClaimPostcards\(/);
    expect(read('lib/tradeSites/pipeline.ts')).toMatch(/sendClaimPostcards\(/);
  });
  it('a real send requires a human to reach', () => {
    expect(read('lib/outreach/claimPostcardSend.ts')).toMatch(/senderProfileReady\(profile\)/);
  });
  it('every new env key is declared', () => {
    const env = read('.env.example');
    for (const k of ['TRADE_PIPELINE_MAIL_ENABLED', 'TRADE_PIPELINE_MAX_MAIL', 'TRADE_PIPELINE_MAIL_MIN_AGE_HOURS']) {
      expect(env).toMatch(new RegExp(`^${k}=`, 'm'));
    }
  });
});
