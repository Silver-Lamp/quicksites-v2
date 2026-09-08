// lib/outreach/listingForProspect.ts
//
// Assemble the richest Listing we can for a prospect: start from its parked fields, then overlay a
// live Place Details fetch (photos + hours — the parts discovery never stores) when the prospect
// carries a place_id and Places is configured. Prospect fields win for identity (name/phone/
// address/website/categories); Google fills the gaps and supplies the photo candidates. Never
// throws — a failed lookup just yields the prospect-only listing.
//
// Shared by the operator's Build button and the nightly pipeline, so both build the same draft.
import type { Prospect } from '@/lib/outreach/prospects';
import { fetchGooglePlace, type Listing } from '@/lib/rebuild/importListing';

export async function listingForProspect(p: Prospect): Promise<Listing> {
  const base: Listing = {
    name: p.business_name,
    phone: p.phone ?? undefined,
    address: p.address ?? undefined,
    website: p.website,
    categories: p.categories ?? [],
  };
  if (!p.place_id) return base;
  const g = await fetchGooglePlace(p.place_id).catch(() => null);
  if (!g) return base;
  return {
    name: base.name || g.name,
    phone: base.phone ?? g.phone,
    address: base.address ?? g.address,
    website: base.website ?? g.website ?? null,
    categories: base.categories?.length ? base.categories : g.categories ?? [],
    hours: g.hours,
    photos: g.photos,
  };
}
