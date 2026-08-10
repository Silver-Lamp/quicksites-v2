// lib/menu/unclaimedNearby.ts
//
// Unclaimed restaurant drafts that belong in a city's dish search.
//
// ⚠️ WHY THEY BELONG AT ALL. We hold 26 drafts with real transcribed menus while a city search
// indexes 4 kitchens. A diner searching "banh mi" in Renton gets nothing, and the reason is
// entirely about our business relationships rather than about their dinner. The restaurant
// exists, the menu came off their own listing photos, and their page is already publicly live at
// its URL — withholding it does not protect them, it just fails the visitor.
//
// ⚠️ WHY THEY ARE NOT EQUAL RESULTS. They have agreed to nothing, cannot take an order, and have
// confirmed no price. The only honest action is their own public phone number — the same thing
// Google offers, and precisely the thing delivered.menu tells diners to do anyway ("call them
// direct"). If an unclaimed row looks like a claimed one, claiming buys nothing and the owners
// who did claim are undercut by the ones who didn't. The GAP between the two rows is the pitch.
//
// ⚠️ AND OPERATOR CURATION STILL BINDS. `city-menu-search` carries a standing rule that the search
// must never surface a restaurant the directory hides — buffet exclusion and manual hides are
// applied once, in the directory loader, and search inherits them. A second data path is exactly
// how that guarantee gets quietly lost, so hidden ids are subtracted here too. A hide means hidden
// everywhere, not hidden from the list it was typed into.

export type UnclaimedCandidate = {
  id: string;
  slug: string | null;
  data: any;
};

export type UnclaimedRestaurant = {
  slug: string;
  name: string;
  url: string;
  data: any;
  unclaimed: true;
  phone: string | null;
};

function contactOf(data: any): any {
  return data?.meta?.contact ?? {};
}

/** City as the draft stored it, lowercased for comparison. Never guessed from an address blob. */
export function draftCity(data: any): string | null {
  const c = contactOf(data).city;
  return typeof c === 'string' && c.trim() ? c.trim().toLowerCase() : null;
}

export function draftRegion(data: any): string | null {
  const r = contactOf(data).state;
  return typeof r === 'string' && r.trim() ? r.trim().toLowerCase() : null;
}

export function draftPhone(data: any): string | null {
  const p = contactOf(data).phone;
  return typeof p === 'string' && p.trim() ? p.trim() : null;
}

/** Does this draft carry at least one real dish? An empty menu adds a row and answers nothing. */
export function hasMenuItems(data: any): boolean {
  const blocks = [
    ...(data?.pages?.[0]?.content_blocks ?? []),
    ...(data?.pages?.[0]?.blocks ?? []),
  ];
  for (const b of blocks) {
    if (b?.type !== 'menu') continue;
    for (const s of b?.content?.sections ?? []) {
      if (Array.isArray(s?.items) && s.items.some((i: any) => String(i?.name ?? '').trim())) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Pick the drafts that should appear in a city's search.
 *
 * ⚠️ CITY MATCH IS EXACT ON THE STORED FIELD, not a radius. A draft two towns over has a
 * different city on it and stays out — a diner on the Renton page looking for dinner in Renton
 * should not be sent to Kent because a bounding box said 9km. The import sweep uses a radius, so
 * the drafts DO spill across town lines; this is where that spill is undone.
 */
export function selectUnclaimedForCity(
  candidates: UnclaimedCandidate[],
  opts: {
    city: string;
    region?: string | null;
    /** Templates already in the directory — never list one twice. */
    excludeTemplateIds?: Iterable<string>;
    /** Operator hides for this campaign. Hidden means hidden everywhere. */
    hiddenTemplateIds?: Iterable<string>;
    /** Absolute URL builder for a draft's public page. */
    urlFor: (slug: string) => string;
  },
): UnclaimedRestaurant[] {
  const city = opts.city.trim().toLowerCase();
  if (!city) return [];
  const region = opts.region?.trim().toLowerCase() || null;
  const skip = new Set<string>([
    ...(opts.excludeTemplateIds ?? []),
    ...(opts.hiddenTemplateIds ?? []),
  ]);

  const out: UnclaimedRestaurant[] = [];
  for (const c of candidates) {
    if (!c.slug || skip.has(c.id)) continue;
    if (draftCity(c.data) !== city) continue;
    if (region && draftRegion(c.data) && draftRegion(c.data) !== region) continue;
    if (!hasMenuItems(c.data)) continue;

    const name =
      (typeof c.data?.meta?.business_name === 'string' && c.data.meta.business_name.trim()) ||
      (typeof c.data?.meta?.siteTitle === 'string' && c.data.meta.siteTitle.trim()) ||
      c.slug;

    out.push({
      slug: c.slug,
      name,
      url: opts.urlFor(c.slug),
      data: c.data,
      unclaimed: true,
      phone: draftPhone(c.data),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
