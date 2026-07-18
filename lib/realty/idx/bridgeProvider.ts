// lib/realty/idx/bridgeProvider.ts
//
// Bridge Interactive (Zillow Group) RESO Web API adapter (docs/REALTY_IDX_PLAN.md). Queries the
// OData Property resource for a dataset with a server token and normalizes RESO-standard fields to
// our `Listing`. Structurally complete but INERT until a real dataset + token are configured on the
// agent's meta.idx — no creds, no calls. The proxy only reaches here when config.provider==='bridge'.
//
// Docs: https://bridgedataoutput.com/docs/platform/API/reso — Property resource, OData $filter/$top.

import type { Listing, ListingProvider, ListingSearch, ListingStatus, IdxConfig } from './types';

const DEFAULT_BASE = 'https://api.bridgedataoutput.com/api/v2/OData';

function mapStatus(s: unknown): ListingStatus {
  const v = String(s ?? '').toLowerCase();
  if (v.includes('active')) return 'active';
  if (v.includes('pending') || v.includes('contingent')) return 'pending';
  if (v.includes('closed') || v.includes('sold')) return 'sold';
  return 'other';
}

/** RESO Property record → our normalized Listing. */
function normalize(p: any): Listing {
  const media = Array.isArray(p?.Media) ? p.Media : [];
  const photos = media
    .map((m: any) => m?.MediaURL || m?.Url)
    .filter((u: any) => typeof u === 'string');
  return {
    id: String(p?.ListingKey ?? p?.ListingId ?? p?.Id ?? crypto.randomUUID?.() ?? Math.random()),
    mlsNumber: p?.ListingId ? String(p.ListingId) : undefined,
    status: mapStatus(p?.StandardStatus ?? p?.MlsStatus),
    price: Number(p?.ListPrice) || 0,
    address: String(
      p?.UnparsedAddress ?? [p?.StreetNumber, p?.StreetName].filter(Boolean).join(' ') ?? ''
    ).trim(),
    city: p?.City ? String(p.City) : undefined,
    state: p?.StateOrProvince ? String(p.StateOrProvince) : undefined,
    postal: p?.PostalCode ? String(p.PostalCode) : undefined,
    beds: Number.isFinite(Number(p?.BedroomsTotal)) ? Number(p.BedroomsTotal) : undefined,
    baths: Number.isFinite(Number(p?.BathroomsTotalInteger))
      ? Number(p.BathroomsTotalInteger)
      : undefined,
    sqft: Number.isFinite(Number(p?.LivingArea)) ? Number(p.LivingArea) : undefined,
    yearBuilt: Number.isFinite(Number(p?.YearBuilt)) ? Number(p.YearBuilt) : undefined,
    propertyType: p?.PropertyType ? String(p.PropertyType) : undefined,
    photos,
    lat: Number.isFinite(Number(p?.Latitude)) ? Number(p.Latitude) : undefined,
    lng: Number.isFinite(Number(p?.Longitude)) ? Number(p.Longitude) : undefined,
    listingOffice: p?.ListOfficeName ? String(p.ListOfficeName) : undefined,
    modified: p?.ModificationTimestamp ? String(p.ModificationTimestamp) : undefined,
  };
}

/** Build a RESO OData $filter from our search params. */
function buildFilter(params: ListingSearch): string {
  const clauses: string[] = [];
  const statusMap: Record<string, string> = {
    active: 'Active',
    pending: 'Pending',
    sold: 'Closed',
  };
  clauses.push(`StandardStatus eq '${statusMap[params.status ?? 'active'] ?? 'Active'}'`);
  if (params.city) clauses.push(`City eq '${params.city.replace(/'/g, "''")}'`);
  if (params.postal) clauses.push(`PostalCode eq '${params.postal.replace(/'/g, "''")}'`);
  if (Number.isFinite(params.minPrice)) clauses.push(`ListPrice ge ${Number(params.minPrice)}`);
  if (Number.isFinite(params.maxPrice)) clauses.push(`ListPrice le ${Number(params.maxPrice)}`);
  if (Number.isFinite(params.minBeds)) clauses.push(`BedroomsTotal ge ${Number(params.minBeds)}`);
  if (Number.isFinite(params.minBaths))
    clauses.push(`BathroomsTotalInteger ge ${Number(params.minBaths)}`);
  return clauses.join(' and ');
}

export const bridgeProvider: ListingProvider = {
  name: 'bridge',
  async search(config: IdxConfig, params: ListingSearch) {
    if (!config.dataset || !config.token) throw new Error('bridge_not_configured');
    const base = (config.baseUrl || DEFAULT_BASE).replace(/\/+$/, '');
    const top = params.limit ?? 24;
    const skip = params.offset ?? 0;
    const url = new URL(`${base}/${encodeURIComponent(config.dataset)}/Property`);
    url.searchParams.set('access_token', config.token);
    url.searchParams.set('$top', String(top));
    if (skip) url.searchParams.set('$skip', String(skip));
    url.searchParams.set('$filter', buildFilter(params));
    url.searchParams.set('$orderby', 'ModificationTimestamp desc');

    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) throw new Error(`bridge_http_${res.status}`);
    const json: any = await res.json().catch(() => ({}));
    const rows: any[] = Array.isArray(json?.value) ? json.value : [];
    const listings = rows.map(normalize).filter((l) => l.address);
    const total = Number(json?.['@odata.count']) || listings.length + skip;
    return { listings, total };
  },
};
