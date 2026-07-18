/**
 * @jest-environment node
 */
// lib/rebuild/__tests__/enrichListingCopy.test.ts
//
// The listing-import path produces templated copy + no page-level SEO meta (so the
// auto-built restaurant site's <title> fell back to "Home"). buildDeterministicSeo always
// stamps a name+locale SEO title/description (even with the LLM off — enrichListingCopy
// applies it before any LLM call), and buildRebuildTemplate writes it into the PAGE-level
// meta that generateMetadata reads.
//
// We test the PURE module (lib/rebuild/listingSeo) directly, not enrichListingCopy — the
// latter imports the AI meter → supabase client, which can't load under jest/Node 20.

import { buildDeterministicSeo, stripPlaceholderLocale } from '@/lib/rebuild/listingSeo';
import { buildRebuildTemplate } from '@/lib/rebuild/assembleDraft';
import type { RebuildSpec } from '@/lib/rebuild/inferSiteSpec';

function spec(overrides: Partial<RebuildSpec> = {}): RebuildSpec {
  return {
    businessName: 'The Local 907',
    industryKey: 'restaurant' as any,
    industryLabel: 'Restaurant',
    headline: 'The Local 907',
    subheadline: 'Bar · Brunch Restaurant — order online or stop by.',
    about: 'The Local 907 — bar. Order online for pickup, or come visit us.',
    services: ['Bar', 'Brunch Restaurant'],
    faqs: [],
    contact: { phone: '907-555-0100', address: '123 4th Ave', city: 'Anchorage', state: 'AK', postal: '99501' },
    ...overrides,
  };
}

describe('buildDeterministicSeo', () => {
  it('leads the title with the business name + category + locale', () => {
    const { seoTitle, seoDescription } = buildDeterministicSeo(spec());
    expect(seoTitle).toBe('The Local 907 — Bar in Anchorage, AK');
    expect(seoDescription).toContain('The Local 907');
    expect(seoDescription).toContain('Anchorage, AK');
    expect(seoDescription).toContain('Order online'); // restaurant tail
  });

  it('never leaks snake_case from raw category slugs', () => {
    const { seoTitle } = buildDeterministicSeo(
      spec({ services: ['brunch_restaurant'], businessName: 'Diner_Co' }),
    );
    expect(seoTitle).not.toContain('_');
    expect(seoTitle).toContain('brunch restaurant');
  });

  it('degrades gracefully with no location and no category', () => {
    const { seoTitle } = buildDeterministicSeo(
      spec({ services: [], contact: undefined, industryLabel: 'Restaurant' }),
    );
    // Name + industry label, no dangling "in ,".
    expect(seoTitle).toBe('The Local 907 — Restaurant');
    expect(seoTitle).not.toContain(' in ,');
  });

  it('respects the <=70 char cap', () => {
    const { seoTitle } = buildDeterministicSeo(
      spec({ businessName: 'A'.repeat(120) }),
    );
    expect(seoTitle.length).toBeLessThanOrEqual(70);
  });
});

describe('stripPlaceholderLocale', () => {
  it('removes invented placeholder locations the LLM emits with no real place', () => {
    expect(stripPlaceholderLocale('Joe’s Diner — Restaurant in Your City')).toBe(
      'Joe’s Diner — Restaurant',
    );
    expect(stripPlaceholderLocale('Fast towing in Your Area')).toBe('Fast towing');
    expect(stripPlaceholderLocale('Milton Towing — Towing in Milton, ST')).toBe(
      'Milton Towing — Towing in Milton',
    );
  });

  it('leaves real locations untouched', () => {
    expect(stripPlaceholderLocale('King Buffet — Asian Cuisine in Renton, WA')).toBe(
      'King Buffet — Asian Cuisine in Renton, WA',
    );
  });
});

describe('buildRebuildTemplate SEO wiring', () => {
  it('writes seoTitle/seoDescription into the page-level meta generateMetadata reads', () => {
    const tpl = buildRebuildTemplate({
      spec: spec({ seoTitle: 'The Local 907 — Bar in Anchorage, AK', seoDescription: 'Order online.' }),
    });
    const page = tpl.data.pages[0];
    expect(page.meta.title).toBe('The Local 907 — Bar in Anchorage, AK');
    expect(page.meta.description).toBe('Order online.');
    // Mirrored into data.meta for the site title + LocalBusiness schema.
    expect(tpl.data.meta.siteTitle).toBe('The Local 907 — Bar in Anchorage, AK');
    expect(tpl.data.meta.description).toBe('Order online.');
  });

  it('leaves page meta untouched when the spec carries no SEO fields', () => {
    const tpl = buildRebuildTemplate({ spec: spec() });
    const page = tpl.data.pages[0];
    expect(page.meta?.title).toBeUndefined();
  });
});
