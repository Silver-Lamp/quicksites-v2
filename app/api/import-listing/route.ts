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
import { createClient } from '@supabase/supabase-js';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { fetchGooglePlace, buildSpecFromListing, ListingImportError, type Listing } from '@/lib/rebuild/importListing';
import { menuFromPhotos } from '@/lib/rebuild/menuFromPhotos';
import { buildRebuildTemplate } from '@/lib/rebuild/assembleDraft';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // vision OCR of several photos

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function uuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id_${Math.random().toString(36).slice(2)}${Date.now()}`;
}

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
    } else if (body.listing && typeof body.listing === 'object' && body.listing.name) {
      listing = body.listing as Listing;
    } else {
      return NextResponse.json({ error: 'Provide a placeId or a listing object with a name.' }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof ListingImportError) {
      const status = e.code === 'not_configured' ? 501 : e.code === 'not_found' ? 404 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    return NextResponse.json({ error: 'Could not load that listing.' }, { status: 500 });
  }

  // 2) Read the menu from photos (explicit photoUrls, else the listing's photos).
  const photoUrls: string[] = Array.isArray(body.photoUrls) && body.photoUrls.length
    ? body.photoUrls.map(String)
    : (listing.photos ?? []);
  let menu;
  try {
    menu = photoUrls.length ? await menuFromPhotos(photoUrls, operator.id) : undefined;
  } catch (e: any) {
    // Menu is best-effort — a vision failure shouldn't block the site assembly.
    menu = undefined;
  }

  // 3) Map → spec → assemble the draft (same blocks as URL conversion).
  const spec = buildSpecFromListing(listing, menu);
  const heroImage = listing.photos?.[0] ?? null;
  const tpl = buildRebuildTemplate({ spec, heroImage, sourceUrl: listing.website ?? null });

  // 4) Insert a claimable draft (operator-owned until the business claims it).
  let insertedId: string | null = null;
  let slug = tpl.slug;
  for (let attempt = 0; attempt < 3 && !insertedId; attempt++) {
    const row: any = {
      id: uuid(),
      template_name: attempt === 0 ? tpl.template_name : `${tpl.template_name} ${attempt + 1}`,
      slug,
      data: tpl.data,
      color_mode: tpl.color_mode,
      header_block: tpl.header_block,
      footer_block: tpl.footer_block,
      is_site: false,
      industry: tpl.industry,
      business_name: tpl.business_name,
      owner_id: operator.id,
      claim_source: 'listing_import',
    };
    const { data, error } = await admin.from('templates').insert(row).select('id, slug').single();
    if (!error && data) {
      insertedId = data.id;
      slug = data.slug;
      break;
    }
    if (error && `${error.code}` === '23505') {
      slug = `${tpl.slug}-${Math.random().toString(36).slice(2, 5)}`;
      continue;
    }
    return NextResponse.json({ error: error?.message || 'Could not save the draft.', code: 'insert_failed' }, { status: 500 });
  }
  if (!insertedId) {
    return NextResponse.json({ error: 'Could not allocate a unique draft.', code: 'insert_failed' }, { status: 500 });
  }

  const menuItemCount = (menu?.sections ?? []).reduce((n, s) => n + s.items.length, 0);
  return NextResponse.json({
    ok: true,
    id: insertedId,
    slug,
    editorUrl: `/admin/templates/${insertedId}`,
    summary: {
      businessName: spec.businessName,
      phone: spec.contact?.phone ?? null,
      address: spec.contact?.address ?? null,
      hoursDays: spec.hours?.length ?? 0,
      menuSections: menu?.sections?.map((s) => `${s.name} (${s.items.length})`) ?? [],
      menuItems: menuItemCount,
      heroImage,
    },
  });
}
