// lib/realty/idx/mockProvider.ts
//
// A deterministic mock IDX provider so the listings proxy + listing_search block can be built,
// demoed, and tested WITHOUT a real MLS feed (docs/REALTY_IDX_PLAN.md, Phase 1). Never used in
// production unless explicitly the configured provider. Pure — no network.

import type { Listing, ListingProvider, ListingSearch } from './types';

const SAMPLE: Listing[] = [
  {
    id: 'mock-1',
    mlsNumber: 'MK1001',
    status: 'active',
    price: 725000,
    address: '1420 Maple Ave',
    city: 'Renton',
    state: 'WA',
    postal: '98057',
    beds: 4,
    baths: 3,
    sqft: 2400,
    yearBuilt: 2015,
    propertyType: 'Single Family',
    photos: ['https://placehold.co/800x600?text=1420+Maple'],
    listingOffice: 'Cascade Realty',
    modified: '2026-07-18T09:00:00Z',
  },
  {
    id: 'mock-2',
    mlsNumber: 'MK1002',
    status: 'active',
    price: 549000,
    address: '88 Sunset Blvd #12',
    city: 'Renton',
    state: 'WA',
    postal: '98056',
    beds: 2,
    baths: 2,
    sqft: 1200,
    yearBuilt: 2008,
    propertyType: 'Condo',
    photos: ['https://placehold.co/800x600?text=88+Sunset'],
    listingOffice: 'Cascade Realty',
    modified: '2026-07-17T15:30:00Z',
  },
  {
    id: 'mock-3',
    mlsNumber: 'MK1003',
    status: 'pending',
    price: 899000,
    address: '305 Highlands Dr',
    city: 'Renton',
    state: 'WA',
    postal: '98059',
    beds: 5,
    baths: 4,
    sqft: 3300,
    yearBuilt: 2020,
    propertyType: 'Single Family',
    photos: ['https://placehold.co/800x600?text=305+Highlands'],
    listingOffice: 'Summit Group',
    modified: '2026-07-16T12:00:00Z',
  },
  {
    id: 'mock-4',
    mlsNumber: 'MK1004',
    status: 'active',
    price: 419000,
    address: '2201 Lake Wa Blvd',
    city: 'Renton',
    state: 'WA',
    postal: '98056',
    beds: 3,
    baths: 1,
    sqft: 1450,
    yearBuilt: 1978,
    propertyType: 'Single Family',
    photos: ['https://placehold.co/800x600?text=2201+Lake'],
    listingOffice: 'Summit Group',
    modified: '2026-07-18T08:15:00Z',
  },
];

export const mockProvider: ListingProvider = {
  name: 'mock',
  async search(_config, params: ListingSearch) {
    let out = SAMPLE.slice();
    const q = (params.q || params.city || params.postal || '').toLowerCase().trim();
    if (q) out = out.filter((l) => `${l.address} ${l.city} ${l.postal}`.toLowerCase().includes(q));
    if (params.status) out = out.filter((l) => l.status === params.status);
    if (Number.isFinite(params.minPrice))
      out = out.filter((l) => l.price >= (params.minPrice as number));
    if (Number.isFinite(params.maxPrice))
      out = out.filter((l) => l.price <= (params.maxPrice as number));
    if (Number.isFinite(params.minBeds))
      out = out.filter((l) => (l.beds ?? 0) >= (params.minBeds as number));
    if (Number.isFinite(params.minBaths))
      out = out.filter((l) => (l.baths ?? 0) >= (params.minBaths as number));
    const total = out.length;
    const offset = Math.max(0, params.offset ?? 0);
    const limit = params.limit ?? 24;
    return { listings: out.slice(offset, offset + limit), total };
  },
};
