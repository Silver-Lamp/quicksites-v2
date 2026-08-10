// lib/menu/nearbyOffPlatform.ts
//
// When the city index has no answer, answer from the sweep instead.
//
// ⚠️ THE SWEEP ALREADY KNOWS EVERY RESTAURANT IN THE CITY; THE SEARCH ONLY KNOWS THE FOUR WE HOST.
// `outreach_prospects` holds 167 Renton businesses gathered for lead-gen — name, phone, address,
// categories — and a diner searching "thai" was told "nobody near you is serving that" while a
// table two joins away listed Thai restaurants a mile from them. Bridging that costs nothing: no
// new API, no per-search spend, no third-party call on a public endpoint. The data was collected
// for our funnel and is more valuable pointed at the visitor.
//
// ⚠️ WE KNOW THE CUISINE, NOT THE DISH — AND THE COPY MUST NEVER BLUR THAT. For a hosted kitchen
// we have a transcribed menu and can say "they serve Pad Thai". For a swept prospect we have a
// business name and a Google category, which supports "these Thai restaurants are nearby" and
// nothing more. Saying a restaurant serves a dish we never read is the same class of invention as
// quoting a price we cannot date: a claim about a business that never asked us to make it.
// `matchReason` exists so the UI is structurally unable to over-claim — it can only render what
// the match was actually based on.
//
// ⚠️ AND THESE ARE NOT LEADS DRESSED AS RESULTS. A restaurant listed here has no page with us and
// may never want one. It gets a name, a phone number and nothing else — no claim bar, no "powered
// by", no tracking link. If the only version of this that ships is one that markets to them, it
// should not ship.

export type ProspectLike = {
  id: string;
  business_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  categories: string[] | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
};

export type NearbyMatch = {
  name: string;
  phone: string | null;
  address: string | null;
  rating: number | null;
  reviewCount: number | null;
  /** What the match was based on — the UI may not claim more than this. */
  matchReason: 'name' | 'category';
  /** True when they have no website of their own: a claimable-draft candidate for us. */
  noWebsite: boolean;
};

/** Words that carry no cuisine signal; matching on them would return the whole city. */
const STOP = new Set([
  'restaurant', 'restaurants', 'food', 'near', 'me', 'the', 'and', 'a', 'an', 'of',
  'place', 'places', 'good', 'best', 'cheap', 'open', 'now', 'takeout', 'delivery',
]);

export function queryTerms(query: string): string[] {
  return String(query ?? '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

function haystack(p: ProspectLike): { name: string; cats: string } {
  return {
    name: String(p.business_name ?? '').toLowerCase(),
    cats: (p.categories ?? []).join(' ').toLowerCase().replace(/_/g, ' '),
  };
}

/**
 * Restaurants in this city that plausibly match what the visitor asked for.
 *
 * ⚠️ A MATCH IS A GUESS ABOUT CUISINE AND IS LABELLED AS ONE. Nothing here inspects a menu,
 * because for these businesses we have never seen one.
 */
export function findNearbyOffPlatform(
  prospects: ProspectLike[],
  opts: { query: string; city: string; region?: string | null; limit?: number },
): NearbyMatch[] {
  const terms = queryTerms(opts.query);
  if (!terms.length) return [];

  const city = opts.city.trim().toLowerCase();
  const region = opts.region?.trim().toLowerCase() || null;
  const out: NearbyMatch[] = [];

  for (const p of prospects) {
    const name = String(p.business_name ?? '').trim();
    if (!name) continue;
    // Same exact-city rule as the unclaimed drafts: a diner on the Renton page is looking for
    // dinner in Renton, not within a radius that happens to include the next town.
    if (String(p.city ?? '').trim().toLowerCase() !== city) continue;
    if (region && p.region && String(p.region).trim().toLowerCase() !== region) continue;

    const h = haystack(p);
    // Name first: "Thai Kitchen" is a stronger signal than a generic category tag.
    const byName = terms.some((t) => h.name.includes(t));
    const byCat = !byName && terms.some((t) => h.cats.includes(t));
    if (!byName && !byCat) continue;

    out.push({
      name,
      phone: p.phone ?? null,
      address: p.address ?? null,
      rating: typeof p.rating === 'number' ? p.rating : null,
      reviewCount: typeof p.review_count === 'number' ? p.review_count : null,
      matchReason: byName ? 'name' : 'category',
      noWebsite: !p.website,
    });
  }

  // A name match beats a category match; then the better-reviewed. Rating is theirs, not ours —
  // it comes from the listing and is shown only where present.
  out.sort(
    (a, b) =>
      Number(a.matchReason === 'category') - Number(b.matchReason === 'category') ||
      (b.rating ?? 0) - (a.rating ?? 0) ||
      (b.reviewCount ?? 0) - (a.reviewCount ?? 0) ||
      a.name.localeCompare(b.name),
  );

  return out.slice(0, Math.max(1, opts.limit ?? 4));
}
