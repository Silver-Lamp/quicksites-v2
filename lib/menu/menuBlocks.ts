// lib/menu/menuBlocks.ts
//
// Read and write a template's menu, correctly, across BOTH block shapes.
//
// ⚠️ THE TRAP THIS EXISTS TO CONTAIN. The fleet carries two coexisting block schemas on the
// same page:
//
//     data.pages[0].blocks[]         → block.props
//     data.pages[0].content_blocks[] → block.content
//
// They are not kept in sync. Eyman's Pizza's real 32-item menu lives ONLY in
// `blocks[].props.sections`; a reader that looks at `content.sections` alone reports it as
// having zero menu items — which is how a menu backfill nearly targeted the wrong
// restaurants, and how a portal edit left a stale untrue sentence serialized in the HTML.
//
// Anything touching menus goes through here rather than reaching into the blob.

export type MenuItem = { name?: string; description?: string; price?: string; tags?: string[] };
export type MenuSection = { name?: string; items?: MenuItem[] };

/**
 * The scaffold's placeholder dishes. Their presence means no real menu was ever sourced —
 * the food scaffold shipped its defaults under a real business's name.
 */
export const PLACEHOLDER_ITEM_NAMES = new Set([
  'Signature Entrée',
  'Two Eggs Any Style',
  'Buttermilk Pancakes',
  'House Burger',
  'Garden Salad',
]);

/** Menu sections from whichever block shape actually carries them. */
export function readMenuSections(data: any): MenuSection[] {
  const page = data?.pages?.[0] ?? {};
  for (const b of [...(page.content_blocks ?? []), ...(page.blocks ?? [])]) {
    if (b?.type !== 'menu') continue;
    const c = b.content ?? b.props ?? {};
    if (Array.isArray(c.sections) && c.sections.length) return c.sections;
  }
  return [];
}

/** Every item name across the menu, flattened. */
export function menuItemNames(sections: MenuSection[]): string[] {
  return sections.flatMap((s) => (s.items ?? []).map((i) => String(i?.name ?? '')).filter(Boolean));
}

/** True when every item is a known scaffold placeholder — i.e. the menu is invented. */
export function isPlaceholderOnly(sections: MenuSection[]): boolean {
  const names = menuItemNames(sections);
  if (!names.length) return false;
  return names.every((n) => PLACEHOLDER_ITEM_NAMES.has(n));
}

/**
 * Strip the food scaffold's invented dishes from a set of blocks, in place.
 *
 * ⚠️ WHY THIS EXISTS. `assembleDraft` used to only REPLACE the scaffold's placeholder menu when a
 * real one was recovered from listing photos. The recovery rate is ~50%, so the other half kept
 * "Two Eggs Any Style", "Buttermilk Pancakes" and "House Burger" under a real business's real name
 * and address, on a page publicly reachable at its own URL. 28 of 59 drafts across two cities.
 *
 * We render NO menu rather than a different menu — the same rule as an ungenerated backdrop
 * painting no layer at all. An empty menu block says "no menu here yet", which is true and is also
 * the thing we want the owner to fix. Invented dishes are a false claim about someone's business
 * that they never asked us to make.
 *
 * ⚠️ Only clears menus that are placeholder-ONLY. A real menu is never touched, and a mixed menu
 * (a real dish beside a scaffold leftover) is left alone deliberately: dropping a real dish to
 * remove a fake one is the wrong trade, and the mixed case wants a human, not a sweep.
 * Operates on BOTH block shapes — see this file's header for why that is not optional.
 */
export function clearInventedMenu(blocks: any[]): boolean {
  let cleared = false;
  for (const b of blocks ?? []) {
    if (b?.type !== 'menu') continue;
    const bag = b.content ?? b.props;
    if (!bag || !Array.isArray(bag.sections)) continue;
    if (!isPlaceholderOnly(bag.sections)) continue;
    bag.sections = [];
    cleared = true;
  }
  return cleared;
}

/** True when this site has a menu we can honestly show a diner. */
export function hasRealMenu(data: any): boolean {
  const sections = readMenuSections(data);
  return sections.length > 0 && !isPlaceholderOnly(sections);
}

/**
 * Write sections into every menu block, preserving each block's existing shape.
 *
 * Flipping a block from `props` to `content` (or back) would make it invisible to whichever
 * render path reads the other one, so the shape is never "normalised" here. If a site has no
 * menu block at all, one is appended — a menu run can add a menu to a site that never had one.
 */
export function writeMenuSections(data: any, sections: MenuSection[]): any {
  const next = JSON.parse(JSON.stringify(data ?? {}));
  const page = next?.pages?.[0];
  if (!page) return next;

  let wroteSomewhere = false;
  for (const key of ['content_blocks', 'blocks'] as const) {
    if (!Array.isArray(page[key])) continue;
    let wroteHere = false;
    page[key] = page[key].map((b: any) => {
      if (b?.type !== 'menu') return b;
      wroteHere = true;
      wroteSomewhere = true;
      // Stamp the verification date. Whoever calls this has just SOURCED this menu — an
      // operator photographing it on the doorstep, or an owner editing their own — which is
      // exactly the event menuFreshness.ts wants dated. Without it every fresh menu would be
      // treated as unknown-age and have its prices replaced with "call to confirm".
      const patched = { ...(b.content ?? b.props ?? {}), sections, verified_at: new Date().toISOString() };
      return b.content ? { ...b, content: patched } : { ...b, props: patched };
    });
    // No menu block in this array — insert one after the hero so it lands where a diner looks.
    if (!wroteHere) {
      const block = { type: 'menu', _id: 'menu-run', content: { title: 'Menu', sections, verified_at: new Date().toISOString() } };
      const heroAt = page[key].findIndex((b: any) => b?.type === 'hero');
      page[key] = heroAt >= 0
        ? [...page[key].slice(0, heroAt + 1), block, ...page[key].slice(heroAt + 1)]
        : [block, ...page[key]];
      wroteSomewhere = true;
    }
  }
  return wroteSomewhere ? next : next;
}

/**
 * Re-enable the sticky order bar's menu CTA.
 *
 * strip-placeholder-menus.ts blanks `cta_href` when it removes an invented menu (the renderer
 * treats an explicit '' as "no menu CTA"). Once a real menu lands, the button has somewhere to
 * go again — without this, a successful menu run leaves the site with a menu nobody can jump to.
 */
export function restoreMenuCta(data: any): any {
  const next = JSON.parse(JSON.stringify(data ?? {}));
  const page = next?.pages?.[0];
  if (!page) return next;
  for (const key of ['content_blocks', 'blocks'] as const) {
    if (!Array.isArray(page[key])) continue;
    page[key] = page[key].map((b: any) => {
      if (b?.type !== 'order_bar') return b;
      const c = b.content ?? b.props ?? {};
      if (c.cta_href) return b; // already pointing somewhere; leave it
      const patched = { ...c, cta_href: '#menu', cta_label: 'View Menu' };
      return b.content ? { ...b, content: patched } : { ...b, props: patched };
    });
  }
  return next;
}
