// lib/commerce/__tests__/starterCatalog.test.ts
//
// Catalog cloning for template duplication — the pure parts. The invariant that
// matters: a duplicated commerce template must NEVER keep ids that sell for the
// source merchant (either everything is remapped to the new owner's clones, or the
// wiring is stripped entirely).

import {
  collectReferencedProductIds,
  stampedMerchantId,
  remapCommerceIds,
  stripCommerceWiring,
} from '../starterCatalog';

const data = () => ({
  meta: { ecom: { merchant_id: 'merch-SOURCE' }, title: 'x' },
  pages: [
    {
      slug: 'index',
      blocks: [
        { _id: 'h1', type: 'hero', content: { headline: 'Wildflower Candle Co.' } },
        { _id: 'g1', type: 'products_grid', content: { product_ids: ['item-a', 'item-b'], productIds: ['item-a', 'item-b'] } },
        { _id: 's1', type: 'service_offer', content: { title: 'Custom pour', productId: 'item-c' } },
      ],
    },
  ],
});

describe('starterCatalog', () => {
  it('collects every referenced id (grid + service_offer) and the merchant stamp', () => {
    expect(collectReferencedProductIds(data()).sort()).toEqual(['item-a', 'item-b', 'item-c']);
    expect(stampedMerchantId(data())).toBe('merch-SOURCE');
  });

  it('remaps ids + merchant; unmapped ids are dropped, never left dangling', () => {
    const next = remapCommerceIds(data(), 'merch-NEW', { 'item-a': 'new-a', 'item-c': 'new-c' }); // item-b has no clone
    const blocks = next.pages[0].blocks;
    expect(blocks[1].content.product_ids).toEqual(['new-a']);
    expect(blocks[1].content.productIds).toEqual(['new-a']);
    expect(blocks[2].content.productId).toBe('new-c');
    expect(next.meta.ecom.merchant_id).toBe('merch-NEW');
    // Nothing anywhere still references the source.
    const text = JSON.stringify(next);
    expect(text).not.toContain('merch-SOURCE');
    expect(text).not.toContain('item-a');
    expect(text).not.toContain('item-b');
  });

  it('stripCommerceWiring removes every way the copy could sell for the source', () => {
    const next = stripCommerceWiring(data());
    const blocks = next.pages[0].blocks;
    expect(blocks[1].content.product_ids).toEqual([]);
    expect(blocks[1].content.productIds).toEqual([]);
    expect(blocks[2].content.productId).toBeUndefined();
    expect(next.meta.ecom.merchant_id).toBeUndefined();
    // Non-commerce content untouched.
    expect(blocks[0].content.headline).toBe('Wildflower Candle Co.');
  });
});
