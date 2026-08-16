// Pins the half-applied-write bug: "Enable ordering" created catalog rows and left the menu
// block unlinked, so the page rendered a priced menu with no way to buy anything.
//
// Observed live on renton-lemonade-fxny (2026-08-15): catalog_items held the lemonade at 300
// cents with both add-on ids, and templates.data carried no catalog_item_id and no meta.ecom.

import { linkCatalogIntoTemplateData, type CatalogLink } from '../menuCatalog';

const LINKS: CatalogLink[] = [
  {
    section: 'Drinks',
    name: 'Lemonade - Homemade Freshly Sqeezed',
    catalog_item_id: 'cat-1',
    price_cents: 300,
    addons: [
      { id: 'strawberry-juice-freshly-pressed', label: 'Strawberry Juice - Freshly Pressed', price_cents: 100 },
      { id: 'blueberry-juice-freshly-pressed', label: 'Blueberry Juice - Freshly Pressed', price_cents: 100 },
    ],
  },
];

const menuContent = () => ({
  title: 'Today’s stand',
  sections: [
    {
      name: 'Drinks',
      items: [
        {
          name: 'Lemonade - Homemade Freshly Sqeezed',
          price: '$3',
          addons: [
            { label: 'Strawberry Juice - Freshly Pressed', price: '$1' },
            { label: 'Blueberry Juice - Freshly Pressed', price: '$1' },
          ],
        },
      ],
    },
  ],
});

const itemOf = (bag: any) => bag.sections[0].items[0];

describe('linkCatalogIntoTemplateData', () => {
  it('links the catalog id onto a content-shaped menu block', () => {
    const data = { pages: [{ content_blocks: [{ type: 'hero' }, { type: 'menu', content: menuContent() }] }] };
    const out = linkCatalogIntoTemplateData(data, LINKS, 'merch-1');

    expect(out.linkedBlocks).toBe(1);
    const item = itemOf(out.data.pages[0].content_blocks[1].content);
    expect(item.catalog_item_id).toBe('cat-1');
    expect(item.price_cents).toBe(300);
  });

  it('gives every add-on a stable id — an add-on without one cannot be ordered', () => {
    const data = { pages: [{ content_blocks: [{ type: 'menu', content: menuContent() }] }] };
    const out = linkCatalogIntoTemplateData(data, LINKS, 'merch-1');

    const addons = itemOf(out.data.pages[0].content_blocks[0].content).addons;
    expect(addons.map((a: any) => a.id)).toEqual([
      'strawberry-juice-freshly-pressed',
      'blueberry-juice-freshly-pressed',
    ]);
  });

  it('writes BOTH content and props when a block carries both', () => {
    // The editor saves both keys and the renderer reads whichever it finds first, so linking
    // only one leaves a stale unlinked copy that can win at render time.
    const data = {
      pages: [{ content_blocks: [{ type: 'menu', content: menuContent(), props: menuContent() }] }],
    };
    const out = linkCatalogIntoTemplateData(data, LINKS, 'merch-1');
    const block = out.data.pages[0].content_blocks[0];

    expect(itemOf(block.content).catalog_item_id).toBe('cat-1');
    expect(itemOf(block.props).catalog_item_id).toBe('cat-1');
  });

  it('links a props-shaped block under the legacy `blocks` key', () => {
    const data = { pages: [{ blocks: [{ type: 'menu', props: menuContent() }] }] };
    const out = linkCatalogIntoTemplateData(data, LINKS, 'merch-1');

    expect(out.linkedBlocks).toBe(1);
    expect(itemOf(out.data.pages[0].blocks[0].props).catalog_item_id).toBe('cat-1');
  });

  it('stamps the merchant without disturbing the rest of meta', () => {
    const data = { meta: { siteTitle: 'Renton Lemonade', ecom: { other: true } }, pages: [] };
    const out = linkCatalogIntoTemplateData(data, LINKS, 'merch-1');

    expect(out.data.meta.ecom.merchant_id).toBe('merch-1');
    expect(out.data.meta.ecom.other).toBe(true);
    expect(out.data.meta.siteTitle).toBe('Renton Lemonade');
  });

  it('reports zero linked blocks when the site has no menu, so the route can say so', () => {
    const data = { pages: [{ content_blocks: [{ type: 'hero' }] }] };
    expect(linkCatalogIntoTemplateData(data, LINKS, 'merch-1').linkedBlocks).toBe(0);
  });

  it('does not mutate the input', () => {
    const data = { pages: [{ content_blocks: [{ type: 'menu', content: menuContent() }] }] };
    linkCatalogIntoTemplateData(data, LINKS, 'merch-1');
    expect(itemOf((data.pages[0].content_blocks[0] as any).content).catalog_item_id).toBeUndefined();
  });
});
