/**
 * @jest-environment node
 */
// lib/seo/__tests__/vehicleJsonLd.test.ts
//
// Search Console, 2026-10-08: "Merchant listings — Missing field image" on
// /sites/starter-auto-dealer, three placeholder cars with `image_url: ''` and a price. A Vehicle
// with an offer is a merchant listing, and a merchant listing needs an image; so no photo, no
// offer.
import fs from 'node:fs';
import path from 'node:path';
import { vehicleItem, vehicleItemListJsonLd, absoluteImage } from '@/lib/seo/vehicleJsonLd';
import { merchantListingGaps } from '@/lib/seo/merchantListingGaps';

const civic = { year: '2019', make: 'Honda', model: 'Civic', trim: 'EX', price: '$18,995', image_url: '' };

describe('vehicleItem', () => {
  it('the starter case: a priced car with no photo is a Vehicle, not a listing', () => {
    const item = vehicleItem(civic);
    expect(item.name).toBe('2019 Honda Civic EX');
    expect(item.offers).toBeUndefined();
    expect(item.image).toBeUndefined();
  });

  it('with an absolute photo URL the offer is emitted, with the image beside it', () => {
    const item = vehicleItem({ ...civic, image_url: 'https://cdn.example.com/civic.jpg' });
    expect(item.image).toBe('https://cdn.example.com/civic.jpg');
    expect(item.offers).toEqual({ '@type': 'Offer', price: 18995, priceCurrency: 'USD' });
  });

  it('a relative image path renders in the <img> but is not a structured-data image', () => {
    expect(absoluteImage({ image_url: '/uploads/civic.jpg' })).toBeNull();
    expect(vehicleItem({ ...civic, image_url: '/uploads/civic.jpg' }).offers).toBeUndefined();
  });

  it('an unparseable price never becomes an offer even with a photo', () => {
    expect(vehicleItem({ ...civic, price: 'Call for price', image_url: 'https://x.test/a.jpg' }).offers).toBeUndefined();
  });
});

describe('the ItemList the block emits', () => {
  it('never contains an object Google would validate as a merchant listing and fail', () => {
    const ld = vehicleItemListJsonLd([civic, { ...civic, make: 'Ford', image_url: 'https://x.test/f150.jpg' }, { year: '2021', make: 'Toyota', model: 'RAV4', price: '$26,995' }]);
    const html = `<script type="application/ld+json">${JSON.stringify(ld)}</script>`;
    expect(merchantListingGaps(html)).toEqual([]);
    expect(ld.itemListElement).toHaveLength(3);
    expect(ld.itemListElement[1].item.offers?.price).toBe(18995);
  });

  it('the renderer uses this module rather than its own copy of the rule', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'components/admin/templates/render-blocks/vehicles-grid.tsx'), 'utf8')
      .replace(/\/\/[^\n]*/g, '');
    expect(src).toMatch(/vehicleItemListJsonLd\(vehicles\)/);
    expect(src).not.toMatch(/'@type': 'Offer'/);
  });
});
