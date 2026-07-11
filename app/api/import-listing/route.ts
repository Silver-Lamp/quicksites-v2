// app/api/import-listing/route.ts
//
// Auto-assemble a restaurant site from a business LISTING (no website needed) — the
// CedarSites cold-outreach engine. Admin/operator-run: given a Google Place ID (or a
// pasted listing JSON) + menu photo URLs, it reads the menu with a vision model,
// maps the listing into a RebuildSpec, and assembles a claimable draft with the same
// menu/location/hours/order_bar blocks the URL-conversion path produces.
//
// Prices are OCR guesses → the owner still confirms them in "Enable ordering" before
// anything is chargeable. Do not scrape Yelp/Google HTML (ToS); use the Places API.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { fetchGooglePlace, findPlace, ListingImportError, type Listing } from '@/lib/rebuild/importListing';
import { buildDraftFromListing, BuildDraftError } from '@/lib/outreach/buildDraftFromListing';
import { mintSiteClaimToken } from '@/lib/auth/siteClaimToken';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // vision OCR of several photos

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // 1) Resolve the listing: a Google Place ID (live API), or a pasted listing JSON.
  let listing: Listing;
  try {
    if (body.placeId) {
      listing = await fetchGooglePlace(String(body.placeId));
    } else if (body.query) {
      const { placeId } = await findPlace(String(body.query));
      listing = await fetchGooglePlace(placeId);
    } else if (body.listing && typeof body.listing === 'object' && body.listing.name) {
      listing = body.listing as Listing;
    } else {
      return NextResponse.json({ error: 'Provide a query, placeId, or a listing object with a name.' }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof ListingImportError) {
      const status = e.code === 'not_configured' ? 501 : e.code === 'not_found' ? 404 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    return NextResponse.json({ error: 'Could not load that listing.' }, { status: 500 });
  }

  // 2) Build + persist the claimable draft (Yelp augment → menu OCR for restaurants →
  //    spec → assemble → insert). Shared with the prospects/build route.
  let built;
  try {
    built = await buildDraftFromListing({ listing, photoUrls: body.photoUrls, operatorId: operator.id });
  } catch (e) {
    if (e instanceof BuildDraftError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 500 });
    }
    return NextResponse.json({ error: 'Could not assemble the draft.' }, { status: 500 });
  }

  const claimToken = mintSiteClaimToken(built.id);
  return NextResponse.json({
    ok: true,
    id: built.id,
    slug: built.slug,
    editorUrl: `/admin/templates/${built.id}`,
    previewUrl: `/preview/${built.slug}`,
    claimUrl: `/claim-site/${built.id}?token=${encodeURIComponent(claimToken)}`,
    summary: built.summary,
  });
}
