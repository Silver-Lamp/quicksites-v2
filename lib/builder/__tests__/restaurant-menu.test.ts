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
  it('restaurant gets a menu-forward layout (menu + hours, no services)', () => {
    const tpl = buildIndustryStarter({ businessName: "Jay's Cafe", industryKey: 'restaurant' });
    const types = blockTypes(tpl);
    expect(types).toEqual(['hero', 'menu', 'hours', 'faq', 'contact_form']);
    const menu = tpl.data.pages[0].blocks.find((b: any) => b.type === 'menu');
    expect(menu.content.sections.length).toBeGreaterThan(0);
  });

  it('a non-food service industry is unchanged (no menu block)', () => {
    const tpl = buildIndustryStarter({ businessName: 'Grafton Towing', industryKey: 'towing' });
    const types = blockTypes(tpl);
    expect(types).toContain('services');
    expect(types).not.toContain('menu');
  });
});
