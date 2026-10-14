/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';
import { isSearching, visibleItems, MENU_FINDER_PREVIEW_CAP } from '@/lib/menu/menuFinderView';
import { stripComments } from '@/test/stripComments';

const items = Array.from({ length: 12 }, (_, i) => ({ id: `d${i}` }));

describe('visibleItems', () => {
  it('browsing: the first five, the rest counted', () => {
    const v = visibleItems(items, { searching: false, expanded: false });
    expect(v.shown).toHaveLength(MENU_FINDER_PREVIEW_CAP);
    expect(v.hidden).toBe(7);
  });
  it('expanded: everything for that restaurant', () => {
    expect(visibleItems(items, { searching: false, expanded: true })).toEqual({ shown: items, hidden: 0 });
  });
  it('searching: everything that matched, never capped — a match beyond the fifth is still a match', () => {
    expect(visibleItems(items, { searching: true, expanded: false })).toEqual({ shown: items, hidden: 0 });
  });
  it('a short list is never given a tap', () => {
    const few = items.slice(0, 5);
    expect(visibleItems(few, { searching: false, expanded: false })).toEqual({ shown: few, hidden: 0 });
  });
});

describe('isSearching', () => {
  it('any query, tag or the open-now filter counts', () => {
    expect(isSearching({ query: '', tags: [], openOnly: false })).toBe(false);
    expect(isSearching({ query: '  ', tags: [], openOnly: false })).toBe(false);
    expect(isSearching({ query: 'pad thai', tags: [], openOnly: false })).toBe(true);
    expect(isSearching({ query: '', tags: ['vegan'], openOnly: false })).toBe(true);
    expect(isSearching({ query: '', tags: [], openOnly: true })).toBe(true);
  });
});

describe('the finder uses the rule for both lists', () => {
  const src = stripComments(fs.readFileSync(path.join(process.cwd(), 'components/admin/templates/render-blocks/menu-finder.tsx'), 'utf8'));
  it('claimed and unclaimed groups both go through visibleItems, with the live search state', () => {
    expect(src.match(/visibleItems\(/g)?.length).toBeGreaterThanOrEqual(2);
    expect(src).toMatch(/isSearching\(\{ query: q, tags: picked, openOnly \}\)/);
    // The old hard-coded slice on the unclaimed list is gone: the cap lives in one place.
    expect(src).not.toMatch(/items\.slice\(0, 4\)/);
  });
});
