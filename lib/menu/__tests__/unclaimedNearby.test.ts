import { buildCityMenuIndex } from '../cityMenuIndex';
import { hasMenuItems, selectUnclaimedForCity } from '../unclaimedNearby';

const menuBlock = (items: Array<{ name: string; price?: string }>) => ({
  type: 'menu',
  content: { sections: [{ name: 'Mains', items }] },
});

function draft(opts: {
  id: string;
  slug: string;
  name: string;
  city: string;
  state?: string;
  phone?: string | null;
  items?: Array<{ name: string; price?: string }>;
}) {
  return {
    id: opts.id,
    slug: opts.slug,
    data: {
      meta: {
        business_name: opts.name,
        contact: { city: opts.city, state: opts.state ?? 'WA', phone: opts.phone ?? '(425) 555-0000' },
      },
      pages: [{ content_blocks: [menuBlock(opts.items ?? [{ name: 'Pad Thai', price: '$14' }])] }],
    },
  };
}

const urlFor = (slug: string) => `https://${slug}.delivered.menu`;

describe('selectUnclaimedForCity', () => {
  it('includes an unclaimed draft in the same city', () => {
    const out = selectUnclaimedForCity([draft({ id: 'a', slug: 'thai-one', name: 'Thai One', city: 'Renton' })], {
      city: 'Renton',
      region: 'WA',
      urlFor,
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: 'Thai One', unclaimed: true, phone: '(425) 555-0000' });
  });

  // ⚠️ The import sweep uses an 8km radius, so drafts DO spill across town lines. A diner on the
  // Renton page looking for dinner in Renton should not be sent to Kent because a circle said so.
  it('excludes a draft from a different city even though the sweep found it', () => {
    const out = selectUnclaimedForCity([draft({ id: 'b', slug: 'kent-thai', name: 'Kent Thai', city: 'Kent' })], {
      city: 'Renton',
      urlFor,
    });
    expect(out).toHaveLength(0);
  });

  // ⚠️ The standing rule: search must never surface a restaurant the directory hides. A second
  // data path is exactly how that guarantee gets lost.
  it('respects an operator hide', () => {
    const d = draft({ id: 'c', slug: 'hidden-one', name: 'Hidden One', city: 'Renton' });
    expect(selectUnclaimedForCity([d], { city: 'Renton', urlFor })).toHaveLength(1);
    expect(
      selectUnclaimedForCity([d], { city: 'Renton', urlFor, hiddenTemplateIds: ['c'] }),
    ).toHaveLength(0);
  });

  it('never lists a restaurant that is already in the directory', () => {
    const d = draft({ id: 'd', slug: 'dupe', name: 'Dupe', city: 'Renton' });
    expect(
      selectUnclaimedForCity([d], { city: 'Renton', urlFor, excludeTemplateIds: ['d'] }),
    ).toHaveLength(0);
  });

  it('skips a draft with no dishes — an empty row answers nothing', () => {
    const d = draft({ id: 'e', slug: 'empty', name: 'Empty', city: 'Renton', items: [] });
    expect(selectUnclaimedForCity([d], { city: 'Renton', urlFor })).toHaveLength(0);
  });

  it('skips a slugless draft, which has no public page to link to', () => {
    const d: any = draft({ id: 'f', slug: 'x', name: 'X', city: 'Renton' });
    d.slug = null;
    expect(selectUnclaimedForCity([d], { city: 'Renton', urlFor })).toHaveLength(0);
  });
});

describe('hasMenuItems', () => {
  it('reads both block arrays, since a page stores its list twice', () => {
    expect(hasMenuItems({ pages: [{ blocks: [menuBlock([{ name: 'Pho' }])] }] })).toBe(true);
    expect(hasMenuItems({ pages: [{ content_blocks: [menuBlock([{ name: 'Pho' }])] }] })).toBe(true);
  });

  it('is false for a menu of blank names', () => {
    expect(hasMenuItems({ pages: [{ content_blocks: [menuBlock([{ name: '  ' }])] }] })).toBe(false);
  });
});

describe('buildCityMenuIndex — the unclaimed flag', () => {
  const listed = { slug: 'claimed', name: 'Claimed Co', url: 'https://claimed', data: { pages: [{ content_blocks: [menuBlock([{ name: 'Pad Thai' }])] }] } };
  const un = {
    slug: 'unclaimed',
    name: 'AAA Unclaimed',
    url: 'https://unclaimed',
    data: { pages: [{ content_blocks: [menuBlock([{ name: 'Pad Thai' }])] }] },
    unclaimed: true,
    phone: '(425) 555-1111',
  };

  it('defaults to claimed — a caller must opt IN to listing an unclaimed page', () => {
    const idx = buildCityMenuIndex([listed]);
    expect(idx.items.every((i) => i.unclaimed === false)).toBe(true);
    expect(idx.restaurants[0].unclaimed).toBe(false);
  });

  it('carries the flag and the phone onto every item', () => {
    const idx = buildCityMenuIndex([un]);
    expect(idx.items[0].unclaimed).toBe(true);
    expect(idx.items[0].restaurantPhone).toBe('(425) 555-1111');
  });

  // ⚠️ Ordering is the guarantee, not a preference: alphabetically "AAA Unclaimed" would win.
  it('always sorts claimed above unclaimed, even against alphabetical order', () => {
    const idx = buildCityMenuIndex([un, listed]);
    expect(idx.restaurants.map((r) => r.name)).toEqual(['Claimed Co', 'AAA Unclaimed']);
  });
});
