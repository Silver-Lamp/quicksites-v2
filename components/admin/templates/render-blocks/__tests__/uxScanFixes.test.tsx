// What the UX scan of /sites/bhard (2026-10-16) found in the renderers, pinned: per-site
// "Hear this page" off, platform-path nav links, FAQ heading level + stray rule, the contact
// picker's empty state, the footer's name-only Company Info column, the 44px CTA, the product
// note, and the woff2 font.
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react';
import ProductsGrid from '@/components/admin/templates/render-blocks/products-grid';
import { siteHearThisPageOff, HEAR_THIS_PAGE_SITE_ATTR } from '@/lib/hearThisPage/config';
import { stripComments } from '@/test/stripComments';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

describe('Hear this page — per-site off', () => {
  it('siteHearThisPageOff reads meta.hear_this_page === false only', () => {
    expect(siteHearThisPageOff({ data: { meta: { hear_this_page: false } } })).toBe(true);
    expect(siteHearThisPageOff({ meta: { hear_this_page: false } })).toBe(true);
    expect(siteHearThisPageOff({ data: { meta: {} } })).toBe(false);
    expect(siteHearThisPageOff({ data: { meta: { hear_this_page: 'no' } } })).toBe(false);
    expect(siteHearThisPageOff(null)).toBe(false);
  });
  it('the renderer stamps the attribute and the pill honours it', () => {
    expect(read('components/sites/site-renderer.tsx')).toMatch(/siteHearThisPageOff\(site\) \? \{ \[HEAR_THIS_PAGE_SITE_ATTR\]: 'off' \}/);
    const pill = read('components/hear-this-page.tsx');
    expect(pill).toMatch(/HEAR_THIS_PAGE_SITE_ATTR\}="off"/);
    expect(pill).toMatch(/if \(siteOff\) return null/);
    expect(HEAR_THIS_PAGE_SITE_ATTR).toBe('data-qs-hear-this-page');
  });
});

describe('nav links stay on the site at /sites/<slug>', () => {
  it('header home + nav and footer links go through rebaseSiteHref', () => {
    const h = read('components/admin/templates/render-blocks/header.tsx');
    expect(h).toMatch(/const homeHref = platformBase \|\| '\/'/);
    expect((h.match(/href=\{hrefFor\(item\.href\)\}/g) ?? []).length).toBe(2);
    expect(h).not.toMatch(/href=\{previewOnly \? '#' : item\.href\}/);
    const f = read('components/admin/templates/render-blocks/footer.tsx');
    expect((f.match(/rebaseSiteHref\(l\.href, platformBase\)/g) ?? []).length).toBe(2);
  });
});

describe('FAQ, contact picker, footer column, hero CTA', () => {
  it('FAQ title is an h2 (non-compact) and the divider is gone', () => {
    const src = read('components/admin/templates/render-blocks/faq.tsx');
    expect(src).toMatch(/<h2 className="text-2xl font-bold tracking-tight mb-5">/);
    expect(src).not.toMatch(/<hr className="my-4 border-border" \/>/);
  });
  it('the contact picker says "Select one" over an owner-typed list', () => {
    const src = read('components/admin/templates/render-blocks/contact-form.tsx');
    expect(src).toMatch(/usingBlockList \? 'Select one'/);
  });
  it('the footer hides a name-only Company Info column outside the editor', () => {
    const src = read('components/admin/templates/render-blocks/footer.tsx');
    expect(src).toMatch(/isPersonal \|\| \(!fullAddressForDisplay && !phone && !showEditorHints\) \? 'hidden'/);
  });
  it('the hero CTA is at least 44px tall', () => {
    const src = read('components/admin/templates/render-blocks/hero.tsx');
    expect((src.match(/inline-flex min-h-\[44px\] items-center justify-center \$\{ctaSize\}/g) ?? []).length).toBe(2);
  });
});

describe('products_grid note', () => {
  it('renders under a display-only gallery, not when empty', () => {
    const content = { title: 'The product', columns: 1, productIds: [], note: 'Online ordering opens soon.', products: [{ id: 'a', title: 'Tin', price_cents: 2500, currency: 'USD' }] };
    const { container } = render(<ProductsGrid block={{ type: 'products_grid', content } as any} />);
    expect(container.querySelector('[data-products-note]')?.textContent).toBe('Online ordering opens soon.');
    const none = render(<ProductsGrid block={{ type: 'products_grid', content: { ...content, note: '' } } as any} />);
    expect(none.container.querySelector('[data-products-note]')).toBeNull();
  });
});

describe('Inter ships as woff2 first', () => {
  it('the subset exists, is small, and the CSS lists it before the TTF', () => {
    const p = path.join(process.cwd(), 'public/fonts/Inter.woff2');
    expect(fs.existsSync(p)).toBe(true);
    expect(fs.statSync(p).size).toBeLessThan(200 * 1024);
    const css = fs.readFileSync(path.join(process.cwd(), 'styles/globals.css'), 'utf8');
    expect(css).toMatch(/url\('\/fonts\/Inter\.woff2'\) format\('woff2'\), url\('\/fonts\/Inter\.ttf'\) format\('truetype'\)/);
  });
});
