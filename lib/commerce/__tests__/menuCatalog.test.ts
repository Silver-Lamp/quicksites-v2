// lib/commerce/__tests__/menuCatalog.test.ts
//
// The "Enable ordering" money-path prep: price parsing, catalog-row building (only
// priced items, unique slugs), and linking catalog ids back onto the menu block.

import { parsePriceToCents, centsToDisplay } from '@/lib/commerce/menuPrice';
import { buildCatalogRowsFromMenu, applyCatalogLinks } from '@/lib/commerce/menuCatalog';

describe('parsePriceToCents', () => {
  it('parses common display prices', () => {
    expect(parsePriceToCents('$14')).toBe(1400);
    expect(parsePriceToCents('14.00')).toBe(1400);
    expect(parsePriceToCents('$12.50')).toBe(1250);
    expect(parsePriceToCents('12.5')).toBe(1250);
    expect(parsePriceToCents(18)).toBe(1800);
  });

  it('takes the first value of a range', () => {
    expect(parsePriceToCents('14/18')).toBe(1400);
    expect(parsePriceToCents('$14 - $18')).toBe(1400);
  });

  it('returns null for non-numeric / market prices', () => {
    expect(parsePriceToCents('MP')).toBeNull();
    expect(parsePriceToCents('Market Price')).toBeNull();
    expect(parsePriceToCents('')).toBeNull();
    expect(parsePriceToCents('—')).toBeNull();
    expect(parsePriceToCents(null)).toBeNull();
    expect(parsePriceToCents(-5)).toBeNull();
  });
});

describe('centsToDisplay', () => {
  it('drops trailing .00 but keeps cents', () => {
    expect(centsToDisplay(1400)).toBe('$14');
    expect(centsToDisplay(1250)).toBe('$12.50');
    expect(centsToDisplay(null)).toBe('');
  });
});

describe('buildCatalogRowsFromMenu', () => {
  const sections = [
    { name: 'Breakfast', items: [
      { name: 'Pancakes', description: 'Fluffy', price_cents: 1000 },
      { name: 'Market Fish', price_cents: null }, // unpriced → skipped
    ] },
    { name: 'Lunch', items: [
      { name: 'Pancakes', price_cents: 1200 }, // same name, different section → unique slug
      { name: 'Nothing', price_cents: 0 }, // zero → skipped
    ] },
  ];

  it('emits only priced items, with unique slugs', () => {
    const rows = buildCatalogRowsFromMenu(sections);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.name)).toEqual(['Pancakes', 'Pancakes']);
    expect(rows.map((r) => r.slug)).toEqual(['breakfast-pancakes', 'lunch-pancakes']);
    expect(rows[0]).toMatchObject({ section: 'Breakfast', price_cents: 1000, description: 'Fluffy' });
  });

  it('suffixes a slug collision within the batch', () => {
    const rows = buildCatalogRowsFromMenu([
      { name: 'Specials', items: [
        { name: 'Combo', price_cents: 900 },
        { name: 'Combo', price_cents: 900 }, // identical → -2
      ] },
    ]);
    expect(rows.map((r) => r.slug)).toEqual(['specials-combo', 'specials-combo-2']);
  });

  it('returns [] for empty / undefined', () => {
    expect(buildCatalogRowsFromMenu(undefined)).toEqual([]);
    expect(buildCatalogRowsFromMenu([])).toEqual([]);
  });
});

describe('applyCatalogLinks', () => {
  it('writes catalog_item_id + price_cents onto matching items only', () => {
    const content = {
      title: 'Our Menu',
      sections: [
        { name: 'Breakfast', items: [{ name: 'Pancakes', price: '$10' }, { name: 'Toast', price: '' }] },
      ],
    };
    const out = applyCatalogLinks(content, [
      { section: 'Breakfast', name: 'Pancakes', catalog_item_id: 'cat_1', price_cents: 1000 },
    ]);
    expect(out.sections[0].items[0]).toMatchObject({
      name: 'Pancakes',
      catalog_item_id: 'cat_1',
      price_cents: 1000,
    });
    // Unmatched item untouched (no catalog_item_id).
    expect(out.sections[0].items[1].catalog_item_id).toBeUndefined();
  });

  it('does not mutate the input content', () => {
    const content = { sections: [{ name: 'A', items: [{ name: 'X' }] }] };
    applyCatalogLinks(content, [{ section: 'A', name: 'X', catalog_item_id: 'c', price_cents: 500 }]);
    expect((content.sections[0].items[0] as any).catalog_item_id).toBeUndefined();
  });
});
