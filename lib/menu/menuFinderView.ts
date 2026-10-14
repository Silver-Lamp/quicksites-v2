// lib/menu/menuFinderView.ts
//
// How many of a restaurant's dishes the city menu finder shows at once (owner, 2026-10-14:
// "give each restaurant a view of maybe 5 items with a tap to expand, but the search must not
// hide items being searched for").
//
// The rule, pure so it can be pinned:
//   - BROWSING (no query, no tags, no open-now filter): the first `cap` dishes, with a count of
//     the rest behind a tap; tapping shows them all for that restaurant.
//   - SEARCHING (any query, tag or filter): every matching dish, always. The list is already
//     narrowed to what the visitor asked for; capping it would hide the very thing they typed,
//     and a "+12 more" under a search for "chicken" is twelve answers withheld.
export const MENU_FINDER_PREVIEW_CAP = 5;

export type MenuFinderSearchState = { query: string; tags: string[]; openOnly: boolean };

export function isSearching(s: MenuFinderSearchState): boolean {
  return s.query.trim().length > 0 || s.tags.length > 0 || s.openOnly;
}

export function visibleItems<T>(
  items: T[],
  opts: { searching: boolean; expanded: boolean; cap?: number },
): { shown: T[]; hidden: number } {
  const cap = opts.cap ?? MENU_FINDER_PREVIEW_CAP;
  if (opts.searching || opts.expanded || items.length <= cap) return { shown: items, hidden: 0 };
  return { shown: items.slice(0, cap), hidden: items.length - cap };
}
