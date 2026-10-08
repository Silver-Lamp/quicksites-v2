// lib/seo/vehicleJsonLd.ts
//
// The Vehicle ItemList a `vehicles_grid` block emits, decided once and purely.
//
// ⚠️ WHY A VEHICLE WITHOUT A PHOTO CARRIES NO PRICE IN STRUCTURED DATA (2026-10-08). Search
// Console mailed "Merchant listings: missing field image" for /sites/starter-auto-dealer. A
// `Vehicle` is a `Product`, and the moment a Product carries an `offers`, Google validates it as
// a merchant listing — which REQUIRES `image`. The starter's three placeholder cars had
// `image_url: ''`, so every one of them was an invalid listing. The card still shows the price
// to a visitor; it is only the machine-readable offer that waits for a photo, because a listing
// Google rejects is worse than a vehicle Google merely reads.
//
// ⚠️ Only an ABSOLUTE http(s) URL counts as an image here. A relative path renders fine in the
// <img>, but Google requires a full URL in structured data and this module cannot know the
// site's origin (the renderer is a client component on an unknown host).

export type VehicleLike = {
  year?: unknown; make?: unknown; model?: unknown; trim?: unknown; price?: unknown; image_url?: unknown;
};

const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

export function vehicleTitle(v: VehicleLike): string {
  return [s(v.year), s(v.make), s(v.model), s(v.trim)].filter(Boolean).join(' ');
}

export function priceDigits(p: string): number | null {
  const n = Number(p.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Usable as a structured-data image: absolute http(s). */
export function absoluteImage(v: VehicleLike): string | null {
  const u = s(v.image_url);
  return /^https?:\/\/\S+$/i.test(u) ? u : null;
}

export type VehicleItem = {
  '@type': 'Vehicle';
  name: string;
  brand?: string;
  model?: string;
  vehicleModelDate?: string;
  image?: string;
  offers?: { '@type': 'Offer'; price: number; priceCurrency: 'USD' };
};

export function vehicleItem(v: VehicleLike): VehicleItem {
  const image = absoluteImage(v);
  const price = priceDigits(s(v.price));
  return {
    '@type': 'Vehicle',
    name: vehicleTitle(v) || 'Vehicle',
    ...(s(v.make) ? { brand: s(v.make) } : {}),
    ...(s(v.model) ? { model: s(v.model) } : {}),
    ...(s(v.year) ? { vehicleModelDate: s(v.year) } : {}),
    ...(image ? { image } : {}),
    // An offer is a merchant listing, and a merchant listing without an image is an error at
    // Google. No photo → no offer, never a listing that fails validation.
    ...(image && price != null ? { offers: { '@type': 'Offer', price, priceCurrency: 'USD' } } : {}),
  };
}

export function vehicleItemListJsonLd(vehicles: VehicleLike[]): {
  '@context': 'https://schema.org';
  '@type': 'ItemList';
  itemListElement: Array<{ '@type': 'ListItem'; position: number; item: VehicleItem }>;
} {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: vehicles.map((v, i) => ({ '@type': 'ListItem', position: i + 1, item: vehicleItem(v) })),
  };
}
