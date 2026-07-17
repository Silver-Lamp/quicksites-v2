// lib/aisleask/storeCategories.ts
//
// The catalogable-store category set for the AisleAsk location-planning sweep. AisleAsk
// catalogs a store's *aisles*, so the targets are aisle-organized retail — groceries,
// supermarkets, big-box, pharmacies, hardware, etc. — NOT the service/no-website trades the
// prospecting sweep hunts. A sweep of a city with these returns catalogable stores WITH
// coords (Places search returns lat/lng in-response), so each swept store becomes a gig with
// precise geo for hands-free route planning. See docs/AISLEASK_OPS_PLAN.md Feature A.
//
// Split into two buckets to match the two Places sweep primitives:
//   - `placesTypes`: real Google Places (New) place-type ids → Nearby Search (searchNearby).
//   - `textQueries`: categories with no clean place type → Text Search (searchTextNearby).

export type StoreCategory = {
  /** Stable key for the UI + selection. */
  key: string;
  /** Human label shown in the picker. */
  label: string;
  /** A Google Places (New) place-type id, when one fits (Nearby Search). */
  placesType?: string;
  /** A free-text query, when no clean place type exists (Text Search). */
  textQuery?: string;
  /** Default-on in the picker (the core high-aisle-count stores). */
  default?: boolean;
};

export const STORE_CATEGORIES: StoreCategory[] = [
  { key: 'grocery_store', label: 'Grocery stores', placesType: 'grocery_store', default: true },
  { key: 'supermarket', label: 'Supermarkets', placesType: 'supermarket', default: true },
  { key: 'convenience_store', label: 'Convenience stores', placesType: 'convenience_store' },
  {
    key: 'department_store',
    label: 'Department / big-box',
    placesType: 'department_store',
    default: true,
  },
  { key: 'warehouse_store', label: 'Warehouse clubs', textQuery: 'warehouse club store' },
  { key: 'drugstore', label: 'Pharmacies / drugstores', placesType: 'drugstore', default: true },
  { key: 'hardware_store', label: 'Hardware stores', placesType: 'hardware_store' },
  {
    key: 'home_improvement_store',
    label: 'Home improvement',
    placesType: 'home_improvement_store',
  },
  { key: 'liquor_store', label: 'Liquor stores', placesType: 'liquor_store' },
  { key: 'pet_store', label: 'Pet stores', placesType: 'pet_store' },
  {
    key: 'discount_store',
    label: 'Discount / dollar stores',
    textQuery: 'dollar store discount store',
  },
  {
    key: 'ethnic_market',
    label: 'Ethnic / international markets',
    textQuery: 'international grocery market',
  },
];

/** Places types selected by key (for searchNearby). */
export function placesTypesFor(keys: string[]): string[] {
  const set = new Set(keys);
  return STORE_CATEGORIES.filter((c) => set.has(c.key) && c.placesType).map(
    (c) => c.placesType!
  ) as string[];
}

/** Free-text queries selected by key (for searchTextNearby). */
export function textQueriesFor(keys: string[]): string[] {
  const set = new Set(keys);
  return STORE_CATEGORIES.filter((c) => set.has(c.key) && c.textQuery).map(
    (c) => c.textQuery!
  ) as string[];
}

/** The default selection (core aisle-heavy stores) for a fresh sweep form. */
export function defaultCategoryKeys(): string[] {
  return STORE_CATEGORIES.filter((c) => c.default).map((c) => c.key);
}
