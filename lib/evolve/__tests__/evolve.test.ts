/**
 * @jest-environment node
 */
// lib/evolve/__tests__/evolve.test.ts
//
// The Evolve page speaks to one real restaurant by name about its own site. Pinned here:
//   1. no sentence makes a promise the claim postcard may not (rankings, guarantees, urgency…)
//      nor a results promise;
//   2. the "likely paying" line is the provider's PUBLISHED pricing read from the compare
//      registry, labelled as published, never a statement about the restaurant's plan;
//   3. every evolved feature in the matrix is one that exists (each row names where);
//   4. the two exhibit lessons from the first UX review: no menu → no evolved frame and no
//      "take it" button; a shop is described as a shop, never as "no online ordering".
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/test/stripComments';
import { buildEvolveModel, COPY, draftHasMenu, nowLineFor, EXAMPLE_SITE } from '@/lib/evolve/evolve';
import { evolveFeatureRows } from '@/lib/evolve/features';
import { detectSiteProvider, providerPublishedPricing } from '@/lib/prospects/siteProvider';
import { frameableFromHeaders } from '@/lib/evolve/frameable';
import { competitorBySlug } from '@/lib/compare/competitors';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

const FORBIDDEN: Array<[RegExp, string]> = [
  [/\brank(s|ing|ed)?\b/i, 'a ranking claim'],
  [/page one|page 1|#1\b/i, 'a page-one claim'],
  [/\bgoogle\b/i, 'a search-engine claim'],
  [/24\s*\/\s*7/i, 'an availability claim about the business'],
  [/licens|insured/i, 'a regulatory claim about the business'],
  [/guarantee/i, 'a guarantee'],
  [/competitor|before someone else|goes to one|whoever lets them/i, 'the competition mechanic'],
  [/claim by|deadline|expires|only \d+ (days|left)/i, 'invented urgency'],
  [/\$\s?\d/, 'a typed price'],
  [/more (customers|orders|sales)|grow your|double|boost/i, 'a results promise'],
];

function allCopy(): string {
  const parts: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string') parts.push(v);
    else if (Array.isArray(v)) v.forEach(push);
    else if (typeof v === 'function') parts.push((v as (...a: any[]) => string)('Wix', 'PRICING', 'July 2026'));
  };
  Object.values(COPY).forEach(push);
  for (const r of evolveFeatureRows({ orderingToday: 'None found', providerLabel: 'Wix', fee: 'FEE' })) parts.push(r.label, r.today ?? '', r.evolved);
  return parts.join('\n');
}

const base = { prospectId: '11111111-1111-1111-1111-111111111111', businessName: 'Rock Island Pizza', website: 'https://www.pizzarockisland.com/', slug: 'rock-island-pizza-x', draftHasMenu: true, orderingPlatform: 'none', currentFrameable: true, base: 'https://www.quicksites.ai', menuHost: 'delivered.menu' };

describe('the page makes no promise the postcard may not', () => {
  const text = allCopy();
  it.each(FORBIDDEN)('never says %s — %s', (re) => {
    expect(text).not.toMatch(re);
  });
  it('no figure is typed into the page or the model — fees and pricing are derived', () => {
    for (const f of ['app/evolve/[prospectId]/page.tsx', 'lib/evolve/evolve.ts', 'lib/evolve/features.ts']) {
      expect(read(f)).not.toMatch(/\$\s?\d/);
      expect(read(f)).not.toMatch(/\d\s?%/);
    }
  });
  it('the fee is in the third "why" paragraph and in the matrix, not only beside the buttons', () => {
    const m = buildEvolveModel({ ...base, siteProvider: null });
    expect(m.why[2]).toContain(m.fee);
    expect(m.rows.find((r) => r.key === 'cost')!.evolved).toBe(m.fee);
    expect(m.fee).toMatch(/of each online order/);
  });
});

describe('what they are likely paying', () => {
  it('a provider with sourced pricing → the registry string, labelled published, plan disclaimed', () => {
    const m = buildEvolveModel({ ...base, siteProvider: 'wix' });
    expect(m.paying).toContain(competitorBySlug('wix')!.pricing);
    expect(m.paying).toMatch(/published pricing/);
    expect(m.paying).toMatch(/Your plan is yours to know/);
    expect(m.payingTitle).toBe(COPY.payingTitle);
    expect(m.payingSources.length).toBeGreaterThan(0);
  });
  it('no sourced pricing or unread → the box is retitled and promises no number', () => {
    const m = buildEvolveModel({ ...base, siteProvider: 'bentobox' });
    expect(m.paying).toContain('BentoBox');
    expect(m.paying).not.toMatch(/\$|likely/);
    expect(m.payingTitle).toBe(COPY.payingTitleUnknown);
    expect(buildEvolveModel({ ...base, siteProvider: null }).paying).toBe(COPY.payingUnread);
    expect(providerPublishedPricing('custom')).toBeNull();
  });
});

describe('the exhibits never contradict the prose', () => {
  it('no menu in the draft → no evolved frame, no "take it", the call is the only step — and a SAMPLE site is framed, labelled as one', () => {
    const m = buildEvolveModel({ ...base, siteProvider: null, draftHasMenu: false });
    expect(m.hasMenu).toBe(false);
    expect(m.evolvedUrl).toBeNull();
    expect(m.evolvedFrameUrl).toBeNull();
    expect(m.claimUrl).toBeNull();
    expect(m.callUrl).toBe('https://www.quicksites.ai/book');
    expect(m.exampleFrameUrl).toBe(`https://www.quicksites.ai/sites/${EXAMPLE_SITE.slug}?exhibit=1`);
    expect(m.exampleUrl).toBe(`https://www.quicksites.ai/sites/${EXAMPLE_SITE.slug}`);
    expect(COPY.exampleNote(m.exampleName)).toMatch(/not a real restaurant/);
    expect(COPY.exampleNote(m.exampleName)).toMatch(/not your menu/);
    // The sample is OUR fictional starter, never another real business's draft.
    expect(EXAMPLE_SITE.slug).toMatch(/^starter-/);
    // With a menu, no sample.
    expect(buildEvolveModel({ ...base, siteProvider: null }).exampleFrameUrl).toBeNull();
  });
  it('with a menu, the framed draft is the exhibit URL and the opened one is the normal one', () => {
    const m = buildEvolveModel({ ...base, siteProvider: null, refCode: 'abdou' });
    expect(m.evolvedFrameUrl).toBe('https://deliveredmenu.com/rock-island-pizza-x?exhibit=1&ref=abdou');
    expect(m.evolvedUrl).toBe('https://deliveredmenu.com/rock-island-pizza-x?ref=abdou');
    expect(m.claimUrl).toBe(`https://www.quicksites.ai/go/${base.prospectId}?ref=abdou`);
  });
  it('a shop is a shop, an app is an app, nothing found is hedged — never "no online ordering" for a cart', () => {
    expect(nowLineFor('woocommerce')).toMatch(/a shop \(WooCommerce\) for things you ship/);
    expect(nowLineFor('woocommerce')).toMatch(/Nothing for ordering a drink or food/);
    expect(nowLineFor('doordash')).toMatch(/through DoorDash/);
    expect(nowLineFor('none')).toMatch(/could not find/);
    expect(nowLineFor(null)).toBe(COPY.nowNone);
    expect(buildEvolveModel({ ...base, siteProvider: null, orderingPlatform: 'woocommerce' }).rows[0].today).toMatch(/no food ordering/);
  });
  it('draftHasMenu reads all three copies of block content and needs at least one item', () => {
    expect(draftHasMenu({ pages: [{ blocks: [{ type: 'menu', content: { sections: [{ name: 'Pizza', items: [{ name: 'Greek' }] }] } }] }] })).toBe(true);
    expect(draftHasMenu({ pages: [{ content_blocks: [{ type: 'menu', props: { sections: [{ name: 'Pizza', items: [{ name: 'Greek' }] }] } }] }] })).toBe(true);
    expect(draftHasMenu({ pages: [{ blocks: [{ type: 'menu', content: { sections: [{ name: 'Pizza', items: [] }] } }] }] })).toBe(false);
    expect(draftHasMenu({ pages: [{ blocks: [{ type: 'hero' }, { type: 'faq' }] }] })).toBe(false);
    expect(draftHasMenu(null)).toBe(false);
  });
  it('the current-site frame is always https — an http iframe on an https page is blank (the first live page)', () => {
    expect(buildEvolveModel({ ...base, siteProvider: null, website: 'http://pizzarockisland.com/' }).currentUrl).toBe('https://pizzarockisland.com/');
    expect(buildEvolveModel({ ...base, siteProvider: null, website: 'http://pizzarockisland.com/', currentFrameUrl: 'http://www.pizzarockisland.com/' }).currentUrl).toBe('https://www.pizzarockisland.com/');
  });
});

describe('detectSiteProvider — markup, not prose', () => {
  it('reads asset hosts and generator tags', () => {
    expect(detectSiteProvider('<img src="https://static.wixstatic.com/media/x.jpg">')).toBe('wix');
    expect(detectSiteProvider('<meta name="generator" content="Squarespace">')).toBe('squarespace');
    expect(detectSiteProvider('<script src="https://img1.wsimg.com/blobby/go/x.js">')).toBe('godaddy');
    expect(detectSiteProvider('<link href="/wp-content/themes/x/style.css">')).toBe('wordpress');
    expect(detectSiteProvider('<p>We moved from Wix to Squarespace last year.</p>')).toBe('custom');
  });
});

describe('frameableFromHeaders', () => {
  const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });
  it('X-Frame-Options and frame-ancestors are honoured; absence means frameable', () => {
    expect(frameableFromHeaders(h({ 'x-frame-options': 'SAMEORIGIN' }), 'https://www.quicksites.ai')).toBe(false);
    expect(frameableFromHeaders(h({ 'x-frame-options': 'DENY' }), 'https://www.quicksites.ai')).toBe(false);
    expect(frameableFromHeaders(h({ 'content-security-policy': "frame-ancestors 'self'" }), 'https://www.quicksites.ai')).toBe(false);
    expect(frameableFromHeaders(h({ 'content-security-policy': 'frame-ancestors *' }), 'https://www.quicksites.ai')).toBe(true);
    expect(frameableFromHeaders(h({}), 'https://www.quicksites.ai')).toBe(true);
  });
});

describe('source guards', () => {
  const page = read('app/evolve/[prospectId]/page.tsx');
  it('noindex; one plain iframe (evolved) + a ScaledFrame (current); no-menu and unframeable fallbacks; a built draft required; no marketing nav', () => {
    expect(page).toMatch(/robots: \{ index: false/);
    // Two plain iframes now: the evolved draft (menu branch) and the sample (no-menu branch).
    expect((page.match(/<iframe/g) ?? []).length).toBe(2);
    expect(page).toMatch(/m\.exampleFrameUrl && m\.exampleUrl/);
    expect(page).toMatch(/<ScaledFrame/);
    expect(page).toMatch(/currentFrameable \?/);
    expect(page).toMatch(/m\.hasMenu && m\.evolvedFrameUrl/);
    expect(page).toMatch(/!p\.template_id/);
    expect(page).toMatch(/links=\{\[\]\}/);
    expect(read('components/evolve/scaled-frame.tsx')).toMatch(/<iframe/);
  });
  it('the framed draft hides its claim bar and preview strip (?exhibit=1), and the launcher stays out of frames', () => {
    const sites = read('app/sites/[slug]/[[...rest]]/page.tsx');
    expect(sites).toMatch(/const exhibit = sp\.exhibit === '1'/);
    expect(sites).toMatch(/showWatermark && !exhibit/);
    expect(sites).toMatch(/showClaimBar && !exhibit/);
    expect(read('components/hear-this-page.tsx')).toMatch(/window\.parent !== window\) return null/);
  });
  it('every evolved matrix row names where it is true in code', () => {
    for (const r of evolveFeatureRows({ orderingToday: null, providerLabel: null, fee: 'FEE' })) expect(r.because.length).toBeGreaterThan(8);
  });
});
