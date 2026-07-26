/**
 * @jest-environment node
 */
// lib/builder/__tests__/restaurant-menu.test.ts
//
// Pins the restaurant vertical work: the `menu` block schema (defaults + lenient
// price coercion so scraped/AI menu data doesn't drop) and the food-industry
// scaffold (restaurant → menu-forward layout, non-food → unchanged).

import { MenuBlockSchema } from '@/admin/lib/zod/blockSchema';
import { buildIndustryStarter } from '@/lib/builder/industryScaffold';

function blockTypes(tpl: any): string[] {
  return (tpl?.data?.pages?.[0]?.blocks ?? []).map((b: any) => b?.type);
}

describe('MenuBlockSchema', () => {
  it('defaults title to "Menu" and sections to []', () => {
    const out = MenuBlockSchema.parse({});
    expect(out.title).toBe('Menu');
    expect(out.sections).toEqual([]);
  });

  it('parses sections + items and keeps optional fields', () => {
    const out = MenuBlockSchema.parse({
      title: 'Our Menu',
      sections: [
        { name: 'Breakfast', items: [{ name: 'Pancakes', price: '$10', tags: ['Popular'] }] },
      ],
    });
    expect(out.title).toBe('Our Menu');
    expect(out.sections[0].name).toBe('Breakfast');
    expect(out.sections[0].items[0]).toMatchObject({ name: 'Pancakes', price: '$10', tags: ['Popular'] });
  });

  it('coerces a numeric item price to a display string (scraped/AI data is messy)', () => {
    const out = MenuBlockSchema.parse({
      sections: [{ name: 'Lunch', items: [{ name: 'Burger', price: 14 as any }] }],
    });
    expect(out.sections[0].items[0].price).toBe('$14');
  });

  it('keeps the ordering linkage fields when present', () => {
    const out = MenuBlockSchema.parse({
      sections: [{ name: 'X', items: [{ name: 'Y', catalog_item_id: 'cat_1', price_cents: 1200 }] }],
    });
    expect(out.sections[0].items[0]).toMatchObject({ catalog_item_id: 'cat_1', price_cents: 1200 });
  });
});

describe('buildIndustryStarter — food vs non-food', () => {
  it('restaurant gets a menu-forward layout (menu + location + hours — no services, no FAQ)', () => {
    const tpl = buildIndustryStarter({ businessName: "Jay's Cafe", industryKey: 'restaurant' });
    const types = blockTypes(tpl);
    // FAQ dropped 2026-07: diners want menu/hours/order — generic Q&A is filler.
    // `about_that` sits after the hero on every scaffold (the "In Your Voice" seed, PR
    // #595) and renders nothing until an embed is set — silent on the page, but present
    // in the block list.
    expect(types).toEqual(['hero', 'about_that', 'menu', 'location', 'hours', 'contact_form', 'order_bar']);
    const menu = tpl.data.pages[0].blocks.find((b: any) => b.type === 'menu');
    expect(menu.content.sections.length).toBeGreaterThan(0);
    const loc = tpl.data.pages[0].blocks.find((b: any) => b.type === 'location');
    expect(loc.content.business_name).toBe("Jay's Cafe");
  });

  it('restaurant chrome: anchor nav (header + footer), hero CTA → #menu, catering-framed contact', () => {
    const tpl = buildIndustryStarter({ businessName: "Jay's Cafe", industryKey: 'restaurant' });
    const blocks = tpl.data.pages[0].blocks;

    const hero = blocks.find((b: any) => b.type === 'hero');
    expect(hero.content.cta_link).toBe('#menu');

    const contact = blocks.find((b: any) => b.type === 'contact_form');
    expect(contact.content.title).toBe('Questions? Catering? Get in touch');

    // Header/footer nav swaps the default Home/Services/Contact page links (which
    // don't exist on a one-page ordering site) for same-page anchors.
    const anchors = ['#menu', '#location', '#contact'];
    const header = tpl.data.headerBlock ?? (tpl as any).headerBlock;
    expect(header.content.nav_items.map((l: any) => l.href)).toEqual(anchors);
    const footer = tpl.data.footerBlock ?? (tpl as any).footerBlock;
    expect(footer.content.links.map((l: any) => l.href)).toEqual(anchors);
  });

  it('non-food keeps the default page nav (anchor swap is food-only)', () => {
    const tpl = buildIndustryStarter({ businessName: 'Grafton Towing', industryKey: 'towing' });
    const header = tpl.data.headerBlock ?? (tpl as any).headerBlock;
    expect(header.content.nav_items.map((l: any) => l.href)).toContain('/');
  });

  it('a non-food service industry is unchanged (no menu block)', () => {
    const tpl = buildIndustryStarter({ businessName: 'Grafton Towing', industryKey: 'towing' });
    const types = blockTypes(tpl);
    expect(types).toContain('services');
    expect(types).not.toContain('menu');
  });
});
