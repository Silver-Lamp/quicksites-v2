// lib/realty/idx/types.ts
//
// Provider-agnostic shapes for the IDX/MLS listings integration (docs/REALTY_IDX_PLAN.md).
// One normalized `Listing` the display blocks render, a `ListingSearch` query, and a
// `ListingProvider` interface every backend (mock / Bridge / SimplyRETS / MLS Grid) implements.
// Keeping these pure + import-free so any layer can use them without dragging in a provider.

export type ListingStatus = 'active' | 'pending' | 'sold' | 'other';

/** A single normalized MLS listing. Fields map from RESO Web API standard names per provider. */
export type Listing = {
  id: string;
  mlsNumber?: string;
  status: ListingStatus;
  price: number; // list price, whole dollars
  address: string;
  city?: string;
  state?: string;
  postal?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  lotSqft?: number;
  yearBuilt?: number;
  propertyType?: string;
  photos: string[];
  /** Public detail URL if the provider/agent site exposes one. */
  url?: string;
  lat?: number;
  lng?: number;
  /** Listing brokerage — required for MLS "courtesy of" attribution. */
  listingOffice?: string;
  /** ISO timestamp of the listing's last modification (shown per MLS rules). */
  modified?: string;
};

/** Search/filter parameters a buyer submits (all optional → recent/active listings). */
export type ListingSearch = {
  q?: string; // free text (city/zip/neighborhood)
  city?: string;
  postal?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  minBaths?: number;
  propertyType?: string;
  status?: ListingStatus;
  limit?: number;
  offset?: number;
};

/** Per-agent feed config (Phase 1: from template.data.meta.idx). Credentials stay server-side. */
export type IdxConfig = {
  provider: 'mock' | 'bridge' | 'simplyrets' | 'mlsgrid';
  /** RESO dataset / server-token / feed id, per provider. */
  dataset?: string;
  token?: string;
  baseUrl?: string;
  mlsName?: string;
  /** Required disclaimer text mandated by the agent's MLS (rendered on every results view). */
  disclaimer?: string;
};

export type ListingResult = {
  listings: Listing[];
  total: number;
  /** Compliance block the display MUST render (disclaimer + attribution note + timestamp). */
  compliance: { disclaimer: string; mlsName?: string; fetchedAt: string };
};

/** Every backend implements this. `search` normalizes the provider's response to `Listing[]`. */
export interface ListingProvider {
  readonly name: IdxConfig['provider'];
  search(config: IdxConfig, params: ListingSearch): Promise<{ listings: Listing[]; total: number }>;
}

export function clampLimit(n: unknown, fallback = 24, max = 50): number {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(max, Math.max(1, Math.round(v))) : fallback;
}
