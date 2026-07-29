import { buildCityMenuIndex, narrow, nextTags, isOpenAt, nearestAvailable } from '../cityMenuIndex';

const site = (slug: string, name: string, items: any[], hours?: any) => ({
  slug,
  name,
  url: `https://${slug}.example`,
  data: {
    pages: [
      {
        content_blocks: [
          { type: 'menu', content: { sections: [{ name: 'Menu', items }] } },
          ...(hours ? [{ type: 'hours', content: hours }] : []),
        ],
      },
    ],
  },
});

const INDEX = buildCityMenuIndex([
  site('a', 'Noodle House', [
    { name: 'Dan Dan Noodles', price: '$16', tags: ['spicy', 'pork', 'noodles'] },
    { name: 'Mushroom Noodles', price: '$15', tags: ['vegan', 'noodles'] },
  ]),
  site('b', 'Taqueria', [
    { name: 'Hongos', price: '$4', tags: ['vegan', 'gluten-free'] },
    { name: 'Birria', price: '$6', tags: ['beef'] },
  ]),
]);

describe('city menu index', () => {
  it('flattens every restaurant into one list', () => {
    expect(INDEX.items).toHaveLength(4);
    expect(INDEX.restaurants.map((r) => r.name)).toEqual(['Noodle House', 'Taqueria']);
  });

  it('ranks tags by frequency', () => {
    const top = INDEX.tags.map((t) => t.tag);
    expect(top).toContain('vegan');
    expect(INDEX.tags.find((t) => t.tag === 'vegan')?.count).toBe(2);
  });

  // AND, not OR. "vegan noodles" must mean both, or narrowing doesn't narrow.
  it('narrows by ALL selected tags', () => {
    expect(narrow(INDEX, { tags: ['vegan'] })).toHaveLength(2);
    expect(narrow(INDEX, { tags: ['vegan', 'noodles'] }).map((i) => i.name)).toEqual([
      'Mushroom Noodles',
    ]);
  });

  it('searches name, description and restaurant', () => {
    expect(narrow(INDEX, { query: 'taqueria' })).toHaveLength(2);
    expect(narrow(INDEX, { query: 'dan dan' })).toHaveLength(1);
  });

  // The property that keeps the search from dead-ending: never offer a chip that empties it.
  it('only offers tags that still lead somewhere', () => {
    const offered = nextTags(INDEX, { tags: ['vegan'] }).map((t) => t.tag);
    expect(offered).toContain('noodles');
    expect(offered).toContain('gluten-free');
    expect(offered).not.toContain('beef'); // no vegan dish is also beef
    expect(offered).not.toContain('vegan'); // already selected
  });

  it('every offered tag yields at least one dish', () => {
    for (const { tag } of nextTags(INDEX, { tags: ['vegan'] })) {
      expect(narrow(INDEX, { tags: ['vegan', tag] }).length).toBeGreaterThan(0);
    }
  });
});

describe('open now', () => {
  const mon = (h: number, m = 0) => new Date(2026, 6, 27, h, m); // a Monday

  it('is null when there are no hours — unknown is not closed', () => {
    expect(isOpenAt(null, mon(12))).toBeNull();
    expect(isOpenAt({ days: [] }, mon(12))).toBeNull();
  });

  it('handles a normal window', () => {
    const hours = { days: [{ key: 'mon', periods: [{ open: '11:00', close: '21:00' }] }] };
    expect(isOpenAt(hours, mon(12))).toBe(true);
    expect(isOpenAt(hours, mon(22))).toBe(false);
    expect(isOpenAt(hours, mon(9))).toBe(false);
  });

  // The case a naive open<=t<close check gets wrong every single night.
  it('handles a window crossing midnight', () => {
    const hours = { days: [{ key: 'mon', periods: [{ open: '17:00', close: '02:00' }] }] };
    expect(isOpenAt(hours, mon(20))).toBe(true);
    // 01:00 Tuesday is still Monday's session.
    expect(isOpenAt(hours, new Date(2026, 6, 28, 1, 0))).toBe(true);
    expect(isOpenAt(hours, new Date(2026, 6, 28, 3, 0))).toBe(false);
  });

  it('respects a closed day and alwaysOpen', () => {
    expect(isOpenAt({ days: [{ key: 'mon', closed: true, periods: [{ open: '11:00', close: '21:00' }] }] }, mon(12))).toBe(false);
    expect(isOpenAt({ alwaysOpen: true, days: [{ key: 'mon' }] }, mon(3))).toBe(true);
  });

  // openOnly must exclude unknown-hours, not treat it as open.
  it('openOnly hides restaurants whose hours we cannot read', () => {
    const idx = buildCityMenuIndex([site('c', 'No Hours', [{ name: 'Thing', tags: ['x'] }])]);
    expect(narrow(idx, {})).toHaveLength(1);
    expect(narrow(idx, { openOnly: true })).toHaveLength(0);
  });
});

// ── Graduated fallback ──────────────────────────────────────────────────────────────────────
// Two bugs in one: leading with "want to cook?" is tone-deaf to someone who just failed while
// hungry, AND it inflates the cook_intent it exists to measure. "Nobody is OPEN" is not the
// same fact as "nobody SERVES it" — the first isn't unmet demand at all.
describe('nearestAvailable', () => {
  // One restaurant, lunch-only, so "open now" can be made to fail deterministically.
  const idx = buildCityMenuIndex([
    site(
      'a',
      'Noodle House',
      [
        { name: 'Pad Thai', price: '$13', tags: ['vegan', 'noodles'] },
        { name: 'Beef Pho', price: '$14', tags: ['beef'] },
      ],
      { days: [{ day: 'Monday', open: '11:00', close: '14:00' }] },
    ),
    // ⚠️ `now` belongs to buildCityMenuIndex, NOT to narrow() — openNow is computed once, at
    // index build. An earlier draft passed `now` in the narrow options, where it is silently
    // ignored: the test still went green, but only because of the real wall clock on the day
    // it ran, and would have flipped on a Monday lunchtime. Pin it here or the assertion is
    // about the calendar, not the code.
  ] as any, new Date('2026-07-27T03:00:00')); // 3am Sunday — nothing is open

  it('says CLOSED NOW rather than nothing, when the dish exists but kitchens are shut', () => {
    // The index above is pinned to 3am; the dish is on a menu, nobody is serving it.
    const opts = { query: 'pad thai', openOnly: true };
    expect(narrow(idx, opts)).toHaveLength(0); // precondition
    const near = nearestAvailable(idx, opts);
    expect(near.kind).toBe('closed_now');
    expect(near.items.map((i) => i.name)).toContain('Pad Thai');
  });

  it('relaxes our own tag chips before the words they typed', () => {
    const near = nearestAvailable(idx, { query: 'pho', tags: ['vegan'] });
    expect(near.kind).toBe('relaxed_tags');
    expect(near.items.map((i) => i.name)).toContain('Beef Pho');
  });

  it('admits none when nobody nearby serves it — the only case that is real unmet demand', () => {
    expect(nearestAvailable(idx, { query: 'biryani' }).kind).toBe('none');
  });

  it('returns none when the search actually had results (nothing to fall back from)', () => {
    expect(nearestAvailable(idx, { query: 'pad thai' }).kind).toBe('none');
  });
});
