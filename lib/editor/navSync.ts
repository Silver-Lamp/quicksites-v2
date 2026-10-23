// lib/editor/navSync.ts
//
// Keep the header's navigation links in step with the site's pages.
//
// ⚠️ "I was hoping those pages would have just automatically showed links up there" (walkthrough,
// 2026-10-22). A customer added About / Services / Join the Team in the pages tray and the header
// still read Home · Services · Contact, pointing at `/services` and `/contact` — paths that were not
// pages. The only way to link a page was to find the header editor, scroll to Navigation Links,
// press "add new link", and pick the page from a dropdown. Now adding, renaming or deleting a page
// adds, updates or removes its link. Links the owner typed by hand (labels they changed, external
// URLs, anchors) are never touched: a rename only rewrites a link whose label still matches the old
// page title, and a delete only removes a link to that exact page path.
//
// Opt-out: `meta.nav_auto === false` (an owner who curates the nav by hand).

export type NavItem = { label?: string; href?: string; appearance?: string; [k: string]: unknown };

export type PageChange =
  | { kind: 'add'; slug: string; title: string }
  | { kind: 'rename'; oldSlug: string; oldTitle: string; slug: string; title: string }
  | { kind: 'delete'; slug: string };

const HOME_SLUGS = new Set(['', 'index', 'home']);

export function pagePath(slug: string): string {
  return HOME_SLUGS.has(slug) ? '/' : `/${slug}`;
}

function samePath(href: unknown, slug: string): boolean {
  if (typeof href !== 'string') return false;
  const h = href.trim().replace(/[?#].*$/, '').replace(/\/+$/, '') || '/';
  return h === pagePath(slug);
}

/** The next nav list for one page change; returns the SAME array when nothing changes. */
export function syncNavItems(items: NavItem[], change: PageChange): NavItem[] {
  if (change.kind === 'add') {
    if (HOME_SLUGS.has(change.slug)) return items;
    if (items.some((it) => samePath(it.href, change.slug))) return items;
    return [...items, { label: change.title || change.slug, href: pagePath(change.slug), appearance: 'default' }];
  }
  if (change.kind === 'delete') {
    if (HOME_SLUGS.has(change.slug)) return items;
    const next = items.filter((it) => !samePath(it.href, change.slug));
    return next.length === items.length ? items : next;
  }
  // rename
  let changed = false;
  const next = items.map((it) => {
    if (!samePath(it.href, change.oldSlug)) return it;
    const out = { ...it, href: pagePath(change.slug) };
    if ((it.label ?? '').trim() === (change.oldTitle ?? '').trim()) out.label = change.title;
    changed = true;
    return out;
  });
  return changed ? next : items;
}

/**
 * Apply a page change to a template's `data`: the header block's `content.nav_items` (and its
 * `props.nav_items` mirror when present). Returns the SAME object when nothing changes.
 */
export function syncNavInData<D extends Record<string, any>>(data: D, change: PageChange): D {
  if (!data || (data as any)?.meta?.nav_auto === false) return data;
  const header = (data as any).headerBlock;
  if (!header || typeof header !== 'object') return data;
  const nextHeader: any = { ...header };
  let changed = false;
  for (const key of ['content', 'props'] as const) {
    const box = header[key];
    if (!box || typeof box !== 'object' || !Array.isArray(box.nav_items)) continue;
    const items = syncNavItems(box.nav_items as NavItem[], change);
    if (items !== box.nav_items) {
      nextHeader[key] = { ...box, nav_items: items };
      changed = true;
    }
  }
  return changed ? ({ ...data, headerBlock: nextHeader } as D) : data;
}

/**
 * The slug a rename should produce. A slug the owner never chose — the tray's own
 * `new-page`, `new-page-2`, or one still derived from the old title — follows the new title;
 * a slug they typed themselves is kept. (Pages titled "About" were living at `/new-page`.)
 */
export function renamedSlug(opts: {
  oldSlug: string;
  oldTitle: string;
  slugDraft: string;
  title: string;
  slugify: (s: string) => string;
}): string {
  const { oldSlug, oldTitle, slugDraft, title, slugify } = opts;
  const draft = slugDraft.trim();
  const untouched = !draft || draft === oldSlug;
  const wasAuto = /^new-page(-\d+)?$/.test(oldSlug) || slugify(oldTitle || '') === oldSlug;
  if (untouched && wasAuto && title.trim()) return slugify(title);
  return slugify(draft || title || oldSlug);
}
