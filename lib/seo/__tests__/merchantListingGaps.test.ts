/**
 * @jest-environment node
 */
// lib/seo/__tests__/merchantListingGaps.test.ts
//
// The live check the indexing sweep runs when Google reports a rich-result error: does the page
// STILL carry a merchant listing without an image? Google's verdict is from its last crawl.
import { merchantListingGaps, jsonLdDocuments } from '@/lib/seo/merchantListingGaps';

// The structured data /sites/starter-auto-dealer served on 2026-10-08, verbatim — the page the
// Search Console email named.
const LIVE_BEFORE = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"ItemList","itemListElement":[{"@type":"ListItem","position":1,"item":{"@type":"Vehicle","name":"2021 Toyota RAV4 XLE AWD","brand":"Toyota","model":"RAV4","vehicleModelDate":"2021","offers":{"@type":"Offer","price":26995,"priceCurrency":"USD"}}},{"@type":"ListItem","position":2,"item":{"@type":"Vehicle","name":"2019 Honda Civic EX","brand":"Honda","model":"Civic","vehicleModelDate":"2019","offers":{"@type":"Offer","price":18995,"priceCurrency":"USD"}}},{"@type":"ListItem","position":3,"item":{"@type":"Vehicle","name":"2020 Ford F-150 XLT 4x4","brand":"Ford","model":"F-150","vehicleModelDate":"2020","offers":{"@type":"Offer","price":34500,"priceCurrency":"USD"}}}]}</script></head></html>`;

describe('merchantListingGaps', () => {
  it('finds all three cars on the page Google complained about', () => {
    expect(merchantListingGaps(LIVE_BEFORE).map((g) => g.name)).toEqual(['2021 Toyota RAV4 XLE AWD', '2019 Honda Civic EX', '2020 Ford F-150 XLT 4x4']);
  });

  it('is empty once the offer is gone or an absolute image is present', () => {
    const fixed = LIVE_BEFORE.replace(/,"offers":\{[^}]*\}/g, '');
    expect(merchantListingGaps(fixed)).toEqual([]);
    const withImage = LIVE_BEFORE.replace(/"offers"/g, '"image":"https://x.test/a.jpg","offers"');
    expect(merchantListingGaps(withImage)).toEqual([]);
  });

  it('a relative or empty image does not satisfy Google and is still a gap', () => {
    const rel = `<script type="application/ld+json">{"@type":"Product","name":"P","image":"/a.jpg","offers":{"@type":"Offer","price":1}}</script>`;
    expect(merchantListingGaps(rel)).toEqual([{ name: 'P', type: 'Product' }]);
  });

  it('reads several scripts, nested graphs, and skips what it cannot parse', () => {
    const html = `<script type="application/ld+json">{not json</script>
      <script type='application/ld+json'>{"@graph":[{"@type":"LocalBusiness","name":"X"},{"@type":"Car","name":"C","offers":{"price":2}}]}</script>`;
    expect(jsonLdDocuments(html)).toHaveLength(1);
    expect(merchantListingGaps(html)).toEqual([{ name: 'C', type: 'Car' }]);
  });

  it('an entity with no offer is never a merchant listing, whatever it lacks', () => {
    expect(merchantListingGaps(`<script type="application/ld+json">{"@type":"Vehicle","name":"V"}</script>`)).toEqual([]);
  });
});
