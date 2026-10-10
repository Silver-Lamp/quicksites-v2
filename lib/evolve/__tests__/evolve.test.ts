/**
 * @jest-environment node
 */
// lib/evolve/__tests__/evolve.test.ts
//
// The Evolve page speaks to one real restaurant by name about its own site. Three things pinned:
//   1. no sentence makes a promise the claim postcard may not (rankings, guarantees, urgency…);
//   2. the "likely paying" line is the provider's PUBLISHED pricing read from the compare
//      registry, labelled as published, never a statement about the restaurant's plan;
//   3. every evolved feature in the matrix is one that exists (each row names where).
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/test/stripComments';
import { buildEvolveModel, COPY } from '@/lib/evolve/evolve';
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
  [/competitor|before someone else|goes to one/i, 'the competition mechanic'],
  [/claim by|deadline|expires|only \d+ (days|left)/i, 'invented urgency'],
  [/\$\s?\d/, 'a typed price'],
  [/more (customers|orders|sales)|grow your|double|boost/i, 'a results promise'],
];

function allCopy(): string {
  const parts: string[] = [];
  for (const v of Object.values(COPY)) {
    if (typeof v === 'string') parts.push(v);
    else if (Array.isArray(v)) parts.push(...v);
    else if (typeof v === 'function') parts.push((v as (...a: any[]) => string)('Wix', 'PRICING', 'July 2026'));
  }
  for (const r of evolveFeatureRows({ orderingToday: 'None found', providerLabel: 'Wix', keepsSite: true })) parts.push(r.label, r.today ?? '', r.evolved);
  return parts.join('\n');
}

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
});

describe('what they are likely paying', () => {
  const base = { prospectId: '11111111-1111-1111-1111-111111111111', businessName: 'Rock Island Pizza', website: 'https://www.pizzarockisland.com/', slug: 'rock-island-pizza-x', orderingPlatform: 'none', currentFrameable: true, base: 'https://www.quicksites.ai', menuHost: 'delivered.menu' };

  it('a provider with sourced pricing → the registry string, labelled published, plan disclaimed', () => {
    const m = buildEvolveModel({ ...base, siteProvider: 'wix' });
    expect(m.paying).toContain(competitorBySlug('wix')!.pricing);
    expect(m.paying).toMatch(/published pricing/);
    expect(m.paying).toMatch(/Your plan is yours to know/);
    expect(m.payingSources.length).toBeGreaterThan(0);
  });
  it('a provider without sourced pricing → named, no figure; unread → says so', () => {
    const m = buildEvolveModel({ ...base, siteProvider: 'bentobox' });
    expect(m.paying).toContain('BentoBox');
    expect(m.paying).not.toMatch(/\$/);
    expect(buildEvolveModel({ ...base, siteProvider: null }).paying).toBe(COPY.payingUnread);
    expect(providerPublishedPricing('custom')).toBeNull();
  });
  it('the current-site frame is always https — an http iframe on an https page is blank (the first live page)', () => {
    expect(buildEvolveModel({ ...base, siteProvider: null, website: 'http://pizzarockisland.com/' }).currentUrl).toBe('https://pizzarockisland.com/');
    expect(buildEvolveModel({ ...base, siteProvider: null, website: 'http://pizzarockisland.com/', currentFrameUrl: 'http://www.pizzarockisland.com/' }).currentUrl).toBe('https://www.pizzarockisland.com/');
    expect(buildEvolveModel({ ...base, siteProvider: null, website: 'pizzarockisland.com' }).currentUrl).toBe('https://pizzarockisland.com');
  });
  it('links: the evolved site on the menu host, the tracked claim link, the booking page; ref carried', () => {
    const m = buildEvolveModel({ ...base, siteProvider: null, refCode: 'abdou' });
    expect(m.evolvedUrl).toBe('https://deliveredmenu.com/rock-island-pizza-x?ref=abdou');
    expect(m.claimUrl).toBe(`https://www.quicksites.ai/go/${base.prospectId}?ref=abdou`);
    expect(m.callUrl).toBe('https://www.quicksites.ai/book?ref=abdou');
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
  it('noindex, two iframes, a link-card fallback when their site refuses framing, requires a built draft', () => {
    expect(page).toMatch(/robots: \{ index: false/);
    // One plain iframe for the (mobile-first) evolved site, one ScaledFrame for their desktop site.
    expect((page.match(/<iframe/g) ?? []).length).toBe(1);
    expect(page).toMatch(/<ScaledFrame/);
    expect(read('components/evolve/scaled-frame.tsx')).toMatch(/<iframe/);
    expect(page).toMatch(/currentFrameable \?/);
    expect(page).toMatch(/!p\.template_id/);
  });
  it('every evolved matrix row names where it is true in code', () => {
    for (const r of evolveFeatureRows({ orderingToday: null, providerLabel: null, keepsSite: true })) expect(r.because.length).toBeGreaterThan(8);
  });
});
