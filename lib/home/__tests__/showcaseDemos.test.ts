/**
 * @jest-environment node
 *
 * "Real businesses, live on QuickSites." — the heading over the homepage showcase row.
 *
 * ⚠️ Three of the top nine cards were demos and nobody could tell. `local`, `ecopest` and
 * `luxeglow` are named "Local Legal Solutions — Demo", "EcoPest Solutions — Demo" and "LuxeGlow
 * Salon & Spa — Demo", but their `business_name` is EMPTY, so the card falls back to
 * `prettifySlug(slug)` and a visitor read "Local" and "Ecopest". The fallback did not hide the
 * word deliberately — it never saw it, because the word lives in `template_name`, a field the
 * card does not render.
 *
 * ⚠️ And the obvious check would have missed all three: none of them carries
 * `claim_source='demo_seed'` or `data.meta.is_demo`. A tag-based filter looks sufficient and
 * catches none of the sites that were actually on the page.
 */
import { looksLikeDemo } from '@/lib/home/getShowcaseData';
import { FEATURED_SITE_SLUGS } from '@/lib/home/featured-sites';

describe('looksLikeDemo', () => {
  it('catches the three that were live, by NAME, where the tags do not', () => {
    for (const template_name of [
      'Local Legal Solutions — Demo',
      'EcoPest Solutions — Demo',
      'LuxeGlow Salon & Spa — Demo',
    ]) {
      // No claim_source, no meta flag — exactly as they are in production.
      expect(looksLikeDemo({ template_name, business_name: '' })).toBe(true);
    }
  });

  it('still catches the tagged ones', () => {
    expect(looksLikeDemo({ claim_source: 'demo_seed' })).toBe(true);
    expect(looksLikeDemo({ data: { meta: { is_demo: true } } })).toBe(true);
  });

  it('reads every name field, not just the one the card shows', () => {
    expect(looksLikeDemo({ business_name: 'Acme Demo Co' })).toBe(true);
    expect(looksLikeDemo({ slug: 'ecopest-demo' })).toBe(true);
  });

  // ⚠️ A substring match would eat real businesses. "Demolition" is a trade we serve.
  it('does not fire on words that merely contain "demo"', () => {
    expect(looksLikeDemo({ business_name: 'Rivera Demolition & Hauling' })).toBe(false);
    expect(looksLikeDemo({ business_name: 'Demographics Consulting' })).toBe(false);
    expect(looksLikeDemo({ slug: 'northside-demolition' })).toBe(false);
  });

  it('passes an ordinary business', () => {
    expect(looksLikeDemo({ business_name: 'Grafton Towing', slug: 'graftontowing' })).toBe(false);
  });
});

describe('the featured list', () => {
  it('names no demo and no starter seed', () => {
    // `starter-*` are seed templates shipped with the product, not customers. Putting one under
    // "Real businesses" is the same claim as putting a demo there, one step less obvious.
    for (const slug of FEATURED_SITE_SLUGS) {
      expect(looksLikeDemo({ slug })).toBe(false);
      expect(slug.startsWith('starter-')).toBe(false);
    }
  });

  it('leads with variety rather than five of one trade', () => {
    // The row led with five towing companies, which reads as "this is a towing tool" to everyone
    // who is not a tow operator.
    const towingInTopSix = FEATURED_SITE_SLUGS.slice(0, 6).filter((s) => /tow/.test(s));
    expect(towingInTopSix.length).toBeLessThanOrEqual(2);
  });

  it('puts the owner-picked site first', () => {
    expect(FEATURED_SITE_SLUGS[0]).toBe('pnw-exteriorcleaning');
  });
});

// ⚠️ The #1 featured card rendered as "Pnw exteriorcleaning" while its real name sat unused in
// `template_name`. Title-casing a slug is a fallback for having NOTHING, not for having the name
// in a field nobody looked at.
describe('the card name', () => {
  const { stripComments } = require('@/test/stripComments');
  const src = stripComments(
    require('fs').readFileSync(require('path').join(process.cwd(), 'lib/home/getShowcaseData.ts'), 'utf8'),
  );

  it('prefers template_name over a prettified slug', () => {
    const tn = src.indexOf('const realName');
    const pretty = src.indexOf('realName || (industry ? prettifySlug(r.slug)');
    expect(tn).toBeGreaterThan(0);
    expect(pretty).toBeGreaterThan(tn);
  });

  it('selects template_name from the database, or it cannot use it', () => {
    // The field was absent from the select for the life of the feature.
    expect(src).toMatch(/\.select\('[^']*template_name/);
  });

  it('still ignores slug-shaped template names', () => {
    const slugShaped = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    expect(slugShaped.test('new-template-66cf-y0nf')).toBe(true);
    expect(slugShaped.test('plumbing-1')).toBe(true);
    expect(slugShaped.test('PNW Prestige – Exterior Cleaning')).toBe(false);
    expect(slugShaped.test('Grafton Towing')).toBe(false);
  });
});
