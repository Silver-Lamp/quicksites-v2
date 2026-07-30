// lib/menu/cityMenuIndex.ts
//
// Flatten a city cohort's menus into one searchable index, and narrow it by tag.
//
// This is the data half of "what are you hungry for?" — the visitor picks a tag, the index
// narrows, and the tags still reachable from that selection are what they can pick next. A
// tag that would lead to zero dishes is never offered, so the search cannot dead-end. That is
// the whole trick of a narrowing search, and it is why the co-occurring-tag computation lives
// here rather than in the component.
//
// Pure and dependency-free so the narrowing can be unit-tested without a database or a DOM.
import { readMenuSections, type MenuItem, type MenuSection } from '@/lib/menu/menuBlocks';
import { assessFreshness, priceOrConfirm } from '@/lib/menu/menuFreshness';
import { looseMatch } from '@/lib/menu/looseMatch';

export type IndexedItem = {
  id: string;
  name: string;
  description?: string;
  price?: string;
  tags: string[];
  restaurantSlug: string;
  restaurantName: string;
  restaurantUrl: string;
  section?: string;
  /** null when the restaurant publishes no hours — "unknown", never guessed as open. */
  openNow: boolean | null;
  /** True when the price shown is "call to confirm" rather than a number we stand behind. */
  priceUnconfirmed: boolean;
};

export type CityMenuIndex = {
  items: IndexedItem[];
  /** Every tag present, most common first. */
  tags: Array<{ tag: string; count: number }>;
  restaurants: Array<{ slug: string; name: string; url: string; itemCount: number; openNow: boolean | null }>;
};

type Period = { open?: string; close?: string };
type Day = { key?: string; closed?: boolean; periods?: Period[] };

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Minutes since midnight, or null when unparseable. */
function hhmm(s?: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

/**
 * Is the business open at `now`?
 *
 * Returns null — NOT false — when there are no hours to read. "We don't know" and "closed"
 * are different answers, and showing a restaurant as closed because we failed to parse its
 * hours would send a hungry visitor away from somewhere that is actually serving.
 *
 * Handles periods that cross midnight (a bar open 17:00–02:00 is open at 01:00), which is the
 * case a naive open<=t<close check gets wrong every night.
 */
export function isOpenAt(hoursContent: any, now: Date): boolean | null {
  const days: Day[] = Array.isArray(hoursContent?.days) ? hoursContent.days : [];
  if (!days.length) return null;
  if (hoursContent?.alwaysOpen === true) return true;

  const dow = now.getDay(); // 0 = Sunday
  const mins = now.getHours() * 60 + now.getMinutes();

  const dayAt = (idx: number): Day | undefined =>
    days.find((d) => String(d?.key ?? '').toLowerCase() === DAY_KEYS[((idx % 7) + 7) % 7]);

  const today = dayAt(dow);
  if (today && today.closed !== true) {
    for (const p of today.periods ?? []) {
      const o = hhmm(p.open);
      const c = hhmm(p.close);
      if (o == null || c == null) continue;
      if (c > o && mins >= o && mins < c) return true;
      if (c <= o && mins >= o) return true; // crosses midnight, still in yesterday's evening
    }
  }

  // A period that began yesterday and runs past midnight.
  const yday = dayAt(dow - 1);
  if (yday && yday.closed !== true) {
    for (const p of yday.periods ?? []) {
      const o = hhmm(p.open);
      const c = hhmm(p.close);
      if (o == null || c == null) continue;
      if (c <= o && mins < c) return true;
    }
  }

  return false;
}

/** The menu block's own content, for its verified date. */
function menuContentOf(data: any): any | null {
  const page = data?.pages?.[0] ?? {};
  for (const b of [...(page.content_blocks ?? []), ...(page.blocks ?? [])]) {
    if (b?.type !== 'menu') continue;
    const c = b.content ?? b.props ?? {};
    if (Array.isArray(c?.sections) && c.sections.length) return c;
  }
  return null;
}

function hoursOf(data: any): any | null {
  const page = data?.pages?.[0] ?? {};
  for (const b of [...(page.content_blocks ?? []), ...(page.blocks ?? [])]) {
    if (b?.type !== 'hours') continue;
    return b.content ?? b.props ?? null;
  }
  return null;
}

/** Normalise a tag for matching: lowercase, trimmed. Display keeps the original casing. */
export function normTag(t: string): string {
  return String(t ?? '').trim().toLowerCase();
}

export function buildCityMenuIndex(
  restaurants: Array<{ slug: string; name: string; url: string; data: any }>,
  now: Date = new Date(),
): CityMenuIndex {
  const items: IndexedItem[] = [];
  const restaurantRows: CityMenuIndex['restaurants'] = [];

  for (const r of restaurants) {
    const openNow = isOpenAt(hoursOf(r.data), now);
    // A price we cannot date is a price we cannot stand behind — see menuFreshness.ts. The
    // substitution happens HERE so every consumer of the index inherits it; a caller that
    // reached past this to the raw price would be re-introducing the exact risk.
    const freshness = assessFreshness(menuContentOf(r.data), now);
    const sections: MenuSection[] = readMenuSections(r.data);
    let count = 0;

    for (const s of sections) {
      for (const raw of s.items ?? []) {
        const it = raw as MenuItem;
        const name = String(it?.name ?? '').trim();
        if (!name) continue;
        count += 1;
        items.push({
          id: `${r.slug}:${name}`,
          name,
          description: it.description ? String(it.description) : undefined,
          price: it.price ? priceOrConfirm(String(it.price), freshness) : undefined,
          priceUnconfirmed: !!it.price && freshness.pricesStale,
          tags: Array.isArray(it.tags) ? it.tags.map(normTag).filter(Boolean) : [],
          restaurantSlug: r.slug,
          restaurantName: r.name,
          restaurantUrl: r.url,
          section: s.name ? String(s.name) : undefined,
          openNow,
        });
      }
    }

    restaurantRows.push({ slug: r.slug, name: r.name, url: r.url, itemCount: count, openNow });
  }

  const counts = new Map<string, number>();
  for (const i of items) for (const t of i.tags) counts.set(t, (counts.get(t) ?? 0) + 1);

  return {
    items,
    tags: [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)),
    restaurants: restaurantRows.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export type NarrowOptions = {
  /** Every selected tag must be present — AND, not OR. Narrowing means narrowing. */
  tags?: string[];
  /** Free text over name + description + restaurant. */
  query?: string;
  /** Hide anything we can't confirm is serving right now. Unknown-hours counts as hidden. */
  openOnly?: boolean;
};

/**
 * The minimum an item needs to be searchable. Both the server-built index rows and the flat
 * rows the public feed hands the browser satisfy this, which is the point: ONE filter, two
 * callers.
 *
 * ⚠️ This generalisation is not tidiness. The finder component carried its own hand-rolled
 * copy of the filter below, annotated "mirrors cityMenuIndex#narrow" — two copies of one
 * truth, which is the single most repeated bug in this repo (`blocks` vs `content_blocks`,
 * `subheadline` vs `subheading`, base_slug in four places). Every fix that held deleted a
 * copy instead of syncing it, so adding a third copy for the fallback was not an option.
 */
export type MatchableItem = {
  name: string;
  description?: string;
  tags: string[];
  restaurantName: string;
  openNow: boolean | null;
};

/** Filter any matchable rows. AND across tags — narrowing means narrowing. */
export function filterItems<T extends MatchableItem>(items: T[], opts: NarrowOptions): T[] {
  const tags = (opts.tags ?? []).map(normTag).filter(Boolean);
  const q = String(opts.query ?? '').trim().toLowerCase();

  return items.filter((i) => {
    if (opts.openOnly && i.openNow !== true) return false;
    if (tags.length && !tags.every((t) => i.tags.includes(t))) return false;
    if (q && !`${i.name} ${i.description ?? ''} ${i.restaurantName}`.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });
}

export function narrow(index: CityMenuIndex, opts: NarrowOptions): IndexedItem[] {
  return filterItems(index.items, opts);
}

/** What we could still offer someone whose search matched nothing. */
export type NearestAvailable =
  /** The dish exists nearby; the kitchens are shut right now. NOT unmet demand. */
  | { kind: 'closed_now'; items: IndexedItem[] }
  /** No exact match, but relaxing the tag filters finds near misses. */
  | { kind: 'relaxed_tags'; items: IndexedItem[] }
  /** Served nearby under a DIFFERENT SPELLING. Our index failed, not the market. */
  | { kind: 'naming'; items: IndexedItem[] }
  /** Genuinely nobody nearby serves this. */
  | { kind: 'none'; items: [] };

/**
 * The graduated fallback for a zero-result search.
 *
 * ⚠️ WHY THIS EXISTS, and it's two bugs not one.
 *
 * (1) UX. A zero-result visitor is hungry and has just failed. Hard-pivoting them into a
 *     40-minute cooking project reads as tone-deaf, and leading with it is also dishonest
 *     about what we know: if a restaurant nearby serves the dish and is merely CLOSED, the
 *     honest answer is "here it is, come back at 11" — not "why not cook?". Cook-it is the
 *     consolation, never the headline. (HiveJournal's catch.)
 *
 * (2) MEASUREMENT, and this is the load-bearing half. A cook-first prompt inflates the very
 *     number it exists to measure — offer cooking to everyone who fails and cook_intent
 *     counts the offer's prominence, not the appetite. Worse, "nobody is OPEN" and "nobody
 *     SERVES it" are different facts that a bare zero-result conflates: the first is not
 *     unmet demand at all, the dish exists. Counting an 11pm closure as demand for a recipe
 *     overstates both the leak and the remedy. Same principle as showing time instead of
 *     price at the fork: an instrument that moves what it measures is worse than none.
 *
 * Order matters — most-available first, so the strongest real answer wins before we ever
 * suggest a stove.
 */
export function nearestAvailableFrom<T extends MatchableItem>(
  items: T[],
  opts: NarrowOptions,
): { kind: NearestAvailable['kind']; items: T[] } {
  // Only reachable when the caller already got nothing; being defensive costs one filter.
  if (filterItems(items, opts).length) return { kind: 'none', items: [] };

  if (opts.openOnly) {
    const anyHour = filterItems(items, { ...opts, openOnly: false });
    if (anyHour.length) return { kind: 'closed_now', items: anyHour };
  }

  // Drop the tag chips but keep what they typed — the words are the intent; the chips were
  // our suggestion. Relaxing our own guess before their query is the right order.
  if ((opts.tags ?? []).length) {
    const looser = filterItems(items, { ...opts, tags: [], openOnly: false });
    if (looser.length) return { kind: 'relaxed_tags', items: looser };
  }

  // Last: is it served under a different SPELLING? `pad thai` vs "Phad Thai". This is our
  // index failing to join two strings, not the market failing to serve a dish — and it must
  // be split out, because a matching bug counted as unmet demand is evidence for the wrong
  // remedy entirely (a synonym layer, not a recipe surface).
  const q = String(opts.query ?? '').trim();
  if (q) {
    const spelled = items.filter((i) =>
      looseMatch(q, `${i.name} ${i.description ?? ''} ${i.restaurantName}`),
    );
    if (spelled.length) return { kind: 'naming', items: spelled };
  }

  return { kind: 'none', items: [] };
}

export function nearestAvailable(index: CityMenuIndex, opts: NarrowOptions): NearestAvailable {
  return nearestAvailableFrom(index.items, opts) as NearestAvailable;
}

/**
 * Tags still worth offering after the current selection — i.e. those that appear on at least
 * one remaining dish. Anything else would narrow to nothing, and offering a chip that empties
 * the page is the fastest way to make a search feel broken.
 */
export function nextTags(
  index: CityMenuIndex,
  opts: NarrowOptions,
): Array<{ tag: string; count: number }> {
  const selected = new Set((opts.tags ?? []).map(normTag));
  const remaining = narrow(index, opts);
  const counts = new Map<string, number>();
  for (const i of remaining) {
    for (const t of i.tags) {
      if (selected.has(t)) continue;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
