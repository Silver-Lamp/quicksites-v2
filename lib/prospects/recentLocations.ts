// lib/prospects/recentLocations.ts
//
// Pure helpers for the "Businesses near me" recent-locations memory. The client
// component persists these to localStorage; keeping the list logic pure (dedupe,
// cap, ordering) makes it testable and keeps the component thin.

export type RecentLocation = {
  city: string;
  region: string;
  /** Sweep radius in km, so a restore reproduces the exact sweep. */
  radiusKm: number;
  /** Category labels that were picked for the sweep (from CATEGORIES). */
  categories: string[];
  /** Epoch ms of the last sweep for this location — most-recent first. */
  usedAt: number;
};

export const RECENT_LOCATIONS_KEY = 'qs:prospects:recent-locations';
export const MAX_RECENT_LOCATIONS = 8;

/** Stable identity for a location: city + region, case/space-insensitive. */
export function locationKey(city: string, region: string): string {
  return `${city.trim().toLowerCase()}::${region.trim().toLowerCase()}`;
}

/** Human label for a location chip/row, e.g. "Boston, MA". */
export function locationLabel(l: Pick<RecentLocation, 'city' | 'region'>): string {
  const city = l.city.trim();
  const region = l.region.trim();
  return region ? `${city}, ${region}` : city;
}

/**
 * Add/refresh a location at the front of the list, deduped by city+region, capped.
 * A repeat sweep of the same place moves it to the front with its newest params.
 */
export function addRecentLocation(list: RecentLocation[], entry: RecentLocation): RecentLocation[] {
  const key = locationKey(entry.city, entry.region);
  const rest = list.filter((l) => locationKey(l.city, l.region) !== key);
  return [entry, ...rest].slice(0, MAX_RECENT_LOCATIONS);
}

/** Coerce arbitrary parsed JSON into a clean, sorted RecentLocation[] (drops junk). */
export function normalizeRecentLocations(raw: unknown): RecentLocation[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: RecentLocation[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.city !== 'string' || !r.city.trim()) continue;
    const region = typeof r.region === 'string' ? r.region : '';
    const key = locationKey(r.city, region);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      city: r.city,
      region,
      radiusKm: typeof r.radiusKm === 'number' && r.radiusKm > 0 ? r.radiusKm : 3,
      categories: Array.isArray(r.categories) ? r.categories.filter((c): c is string => typeof c === 'string') : [],
      usedAt: typeof r.usedAt === 'number' ? r.usedAt : 0,
    });
  }
  return out.sort((a, b) => b.usedAt - a.usedAt).slice(0, MAX_RECENT_LOCATIONS);
}

/** Compact relative "used" label, e.g. "just now", "3d ago". */
export function relativeUsed(usedAt: number, now: number): string {
  const diff = Math.max(0, now - usedAt);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
