/**
 * @jest-environment node
 */
// lib/seo/__tests__/localPages.test.ts

import {
  buildCityServicePage,
  buildAreaGuidePage,
  insertPage,
  slugForCityService,
  slugForArea,
  hasPageSlug,
} from '@/lib/seo/localPages';

describe('buildAreaGuidePage', () => {
  const page = buildAreaGuidePage({
    businessName: 'Jane Realty',
    area: 'Renton Highlands',
    region: 'WA',
    highlights: ['Top-rated schools', 'Quick I-405 commute'],
  });

  it('targets "Homes for sale in <area>" in slug/title/hero', () => {
    expect(page.slug).toBe('homes-for-sale-in-renton-highlands');
    expect(slugForArea('Renton Highlands')).toBe('homes-for-sale-in-renton-highlands');
    expect(page.title).toBe('Homes for sale in Renton Highlands');
    expect(page.blocks[0].content.headline).toBe('Homes for sale in Renton Highlands');
  });

  it('seeds a listings grid and links back to home + contact', () => {
    expect(page.blocks.some((b: any) => b.type === 'listings_grid')).toBe(true);
    const body = page.blocks.find((b: any) => b.type === 'text');
    expect(body.content.value).toContain('href="/"');
    expect(body.content.value).toContain('href="#contact"');
    expect(body.content.value).toContain('Top-rated schools');
  });
});

describe('slugForCityService', () => {
  it('builds "<service>-in-<city>"', () => {
    expect(slugForCityService('Plumbing', 'Renton')).toBe('plumbing-in-renton');
    expect(slugForCityService('Heating & Air', 'San Jose')).toBe('heating-and-air-in-san-jose');
  });
});

describe('buildCityServicePage', () => {
  const page = buildCityServicePage({
    businessName: 'Renton Plumbing',
    serviceLabel: 'Plumbing',
    city: 'Renton',
    region: 'WA',
    services: ['Drain cleaning', 'Water heaters'],
  });

  it('targets the "<service> in <city>" query in the hero + title + slug', () => {
    expect(page.slug).toBe('plumbing-in-renton');
    expect(page.title).toBe('Plumbing in Renton');
    const hero = page.blocks.find((b: any) => b.type === 'hero');
    expect(hero.content.headline).toBe('Plumbing in Renton');
  });

  it('includes internal links back to the home page + contact (the SEO win)', () => {
    const text = page.blocks.find((b: any) => b.type === 'text');
    expect(text.content.value).toContain('href="/"');
    expect(text.content.value).toContain('href="#contact"');
    expect(text.content.value).toContain('Renton');
  });

  it('lists the provided services', () => {
    const text = page.blocks.find((b: any) => b.type === 'text');
    expect(text.content.value).toContain('Drain cleaning');
    const svc = page.blocks.find((b: any) => b.type === 'services');
    expect(svc).toBeTruthy();
  });

  it('mirrors blocks to content_blocks + blocks', () => {
    expect(page.content_blocks).toBe(page.blocks);
  });
});

describe('insertPage', () => {
  it('appends the page and is idempotent by slug', () => {
    const page = buildCityServicePage({
      businessName: 'X',
      serviceLabel: 'Towing',
      city: 'Grafton',
    });
    const data: any = { pages: [{ slug: 'index', blocks: [] }] };
    const first = insertPage(data, page);
    expect(first.changed).toBe(true);
    expect(first.data.pages).toHaveLength(2);
    // original untouched (pure)
    expect(data.pages).toHaveLength(1);
    const second = insertPage(first.data, page);
    expect(second.changed).toBe(false);
    expect(second.data.pages).toHaveLength(2);
  });

  it('creates the pages array when missing', () => {
    const page = buildCityServicePage({ businessName: 'X', serviceLabel: 'HVAC', city: 'Boston' });
    const r = insertPage({}, page);
    expect(r.changed).toBe(true);
    expect(r.data.pages).toHaveLength(1);
  });

  it('hasPageSlug is case-insensitive', () => {
    expect(hasPageSlug({ pages: [{ slug: 'Plumbing-In-Renton' }] }, 'plumbing-in-renton')).toBe(
      true
    );
  });
});
