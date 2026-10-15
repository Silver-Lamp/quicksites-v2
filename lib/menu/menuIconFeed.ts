// lib/menu/menuIconFeed.ts
//
// The site's menu as a partner reads it — grouped by its own sections, each dish carrying the
// icon the delivered.menu renderer would draw for it — plus an icon lookup for arbitrary names
// (a food-cost planner's ingredient list). Owner, 2026-10-15: "we had an icon set we used for
// food menu items for delivered.menu, can we do similar for the food cost area, and have things
// grouped by category." HiveJournal builds the planner; the icons and the categories are ours,
// so they are SERVED, never copied — one matcher, one set, no drift.
//
// ⚠️ Same honesty rule as the renderer (lib/menu/foodIcons.ts): no match → `icon_key: null`,
// and the planner draws nothing. A guanciale with a generic "food" icon would be a claim the
// set never makes. The dictionary carries only the icons actually used, as 24×24 inner SVG
// markup on currentColor plus the emoji counterpart, so the planner can draw either set.
import { FOOD_ICONS, matchFoodIcon, readMenuIconSet, type MenuIconSet } from '@/lib/menu/foodIcons';
import { readMenuSections } from '@/lib/menu/menuBlocks';

export type IconEntry = { label: string; emoji: string; svg: string };
export type FeedItem = { name: string; description: string | null; price: string | null; tags: string[]; icon_key: string | null };
export type FeedSection = { name: string; description: string | null; items: FeedItem[] };
export type MenuFeed = { icon_set: MenuIconSet; currency: string | null; sections: FeedSection[]; icons: Record<string, IconEntry> };

function entry(key: string): IconEntry | null {
  const i = FOOD_ICONS[key];
  return i ? { label: i.label, emoji: i.emoji, svg: i.path } : null;
}

/** The menu, grouped by its own sections, each item with its matched icon key. */
export function buildMenuFeed(data: unknown): MenuFeed {
  const d = data as any;
  const sections = readMenuSections(d);
  const used = new Set<string>();
  const out: FeedSection[] = sections
    .map((s: any) => ({
      name: String(s?.name ?? '').trim() || 'Menu',
      description: String(s?.description ?? '').trim() || null,
      items: (Array.isArray(s?.items) ? s.items : [])
        .filter((it: any) => String(it?.name ?? '').trim())
        .map((it: any) => {
          const tags = Array.isArray(it?.tags) ? it.tags.map((t: unknown) => String(t)) : [];
          const key = matchFoodIcon(it.name, tags);
          if (key) used.add(key);
          return { name: String(it.name).trim(), description: String(it?.description ?? '').trim() || null, price: String(it?.price ?? '').trim() || null, tags, icon_key: key };
        }),
    }))
    .filter((s) => s.items.length);
  const currency = (() => {
    const page = d?.pages?.[0] ?? {};
    for (const b of [...(page.content_blocks ?? []), ...(page.blocks ?? [])]) if (b?.type === 'menu') return String((b.content ?? b.props ?? {}).currency ?? '').trim() || null;
    return null;
  })();
  const icons: Record<string, IconEntry> = {};
  for (const k of used) {
    const e = entry(k);
    if (e) icons[k] = e;
  }
  return { icon_set: readMenuIconSet(d), currency, sections: out, icons };
}

export type NameQuery = { name: string; tags?: string[]; prefer?: 'dish' | 'ingredient' };

/** Icons for arbitrary names — an ingredient list prefers the ingredient reading ("Strawberry Juice" → strawberry). */
export function iconsForNames(queries: NameQuery[]): { matches: Array<{ name: string; icon_key: string | null }>; icons: Record<string, IconEntry> } {
  const icons: Record<string, IconEntry> = {};
  const matches = queries.slice(0, 200).map((q) => {
    const name = String(q?.name ?? '').trim();
    const key = name ? matchFoodIcon(name, Array.isArray(q.tags) ? q.tags : null, { prefer: q.prefer === 'dish' ? 'dish' : 'ingredient' }) : null;
    if (key && !icons[key]) {
      const e = entry(key);
      if (e) icons[key] = e;
    }
    return { name, icon_key: key };
  });
  return { matches, icons };
}
