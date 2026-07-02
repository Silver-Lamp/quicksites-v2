// lib/commerce/__tests__/variants.test.ts
//
// Normalization of authored variants → stored metadata (multi-axis feature).
// The stored `variants` is always a flat SKU list, so checkout stays axis-blind.

import { normalizeVariants } from '../variants';

describe('normalizeVariants', () => {
  it('returns the fallback base and no variants for a plain product', () => {
    const r = normalizeVariants({ fallbackBaseCents: 1999 });
    expect(r.variants).toEqual([]);
    expect(r.variant_options).toEqual([]);
    expect(r.basePriceCents).toBe(1999);
  });

  it('normalizes single-axis variants and sets base price to the cheapest', () => {
    const r = normalizeVariants({
      variantOptions: [{ name: 'Size', values: ['Small', 'Large'] }],
      variants: [
        { label: 'Small', priceCents: 1500, options: { Size: 'Small' } },
        { label: 'Large', priceCents: 2000, options: { Size: 'Large' } },
      ],
    });
    expect(r.variant_options).toEqual([{ name: 'Size', values: ['Small', 'Large'] }]);
    expect(r.variants.map((v) => [v.id, v.label, v.price_cents])).toEqual([
      ['small', 'Small', 1500],
      ['large', 'Large', 2000],
    ]);
    expect(r.basePriceCents).toBe(1500);
  });

  it('builds a multi-axis grid with combo ids/labels from the option values', () => {
    const r = normalizeVariants({
      variantOptions: [{ name: 'Size', values: ['S', 'M'] }, { name: 'Color', values: ['Red', 'Blue'] }],
      variants: [
        { priceCents: 2000, options: { Size: 'S', Color: 'Red' } },
        { priceCents: 2200, options: { Size: 'M', Color: 'Blue' } },
      ],
    });
    expect(r.variants).toEqual([
      { id: 's-red', label: 'S / Red', price_cents: 2000, status: 'active', options: { Size: 'S', Color: 'Red' } },
      { id: 'm-blue', label: 'M / Blue', price_cents: 2200, status: 'active', options: { Size: 'M', Color: 'Blue' } },
    ]);
    expect(r.basePriceCents).toBe(2000);
  });

  it('dedupes ids and drops option keys that are not declared axes', () => {
    const r = normalizeVariants({
      variantOptions: [{ name: 'Size', values: ['M'] }],
      variants: [
        { label: 'M', priceCents: 100, options: { Size: 'M', Bogus: 'x' } },
        { label: 'M', priceCents: 200, options: { Size: 'M' } }, // same combo → id collision
      ],
    });
    expect(r.variants.map((v) => v.id)).toEqual(['m', 'm-2']);
    expect(r.variants[0].options).toEqual({ Size: 'M' }); // Bogus dropped
  });

  it('cleans axis values (trim, drop empties, dedupe)', () => {
    const r = normalizeVariants({
      variantOptions: [{ name: ' Size ', values: [' S ', 'S', '', 'M'] }],
      variants: [{ label: 'x', priceCents: 100 }],
    });
    expect(r.variant_options).toEqual([{ name: 'Size', values: ['S', 'M'] }]);
  });

  it('coerces prices to non-negative integer cents and honors inactive status', () => {
    const r = normalizeVariants({
      variantOptions: [{ name: 'Size', values: ['S'] }],
      variants: [{ label: 'S', priceCents: -50.9 as any, status: 'inactive', options: { Size: 'S' } }],
    });
    expect(r.variants[0].price_cents).toBe(0);
    expect(r.variants[0].status).toBe('inactive');
  });

  it('skips a variant with neither a label nor resolvable options', () => {
    const r = normalizeVariants({ variants: [{ priceCents: 100 }] });
    expect(r.variants).toEqual([]);
  });
});
