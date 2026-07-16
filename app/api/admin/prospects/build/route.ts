// app/api/admin/prospects/build/route.ts
//
// Selectively build draft sites for chosen prospects. This is where AI is spent (menu
// OCR for restaurants), only for the businesses the operator picks — the "build" half
// of discover-then-selective-build. Reuses the shared listing→draft builder, so each
// draft lands in /admin/outreach with the same claim/QR flow.
//
// Menu photos are the bottleneck for the restaurant ordering-site pipeline: discovery
// parks a prospect cheaply (no photos), so we do a best-effort Place Details fetch here
// — at build time, only for the picked few — to pull the menu-photo candidates + hours
// that make menu OCR actually land. Falls back to prospect-only data when Places is
// unconfigured or the lookup fails, so a build never blocks on it.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getProspect, markProspectBuilt, type Prospect } from '@/lib/outreach/prospects';
import { buildDraftFromListing, BuildDraftError } from '@/lib/outreach/buildDraftFromListing';
import { mintSiteClaimToken } from '@/lib/auth/siteClaimToken';
import { fetchGooglePlace, type Listing } from '@/lib/rebuild/importListing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // vision OCR for restaurant prospects

const MAX_BATCH = 10; // cap synchronous builds per request (AI cost + serverless time)

/**
 * Assemble the richest Listing we can for a prospect: start from its parked fields,
 * then overlay a live Place Details fetch (photos + hours — the parts discovery never
 * stores) when the prospect carries a place_id and Places is configured. Prospect
 * fields win for identity (name/phone/address/website/categories); Google fills the
 * gaps and supplies the menu-photo candidates. Never throws — a failed lookup just
 * yields the prospect-only listing.
 */
async function listingForProspect(p: Prospect): Promise<Listing> {
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
    photos: g.photos, // the point: menu-photo candidates for OCR + a hero image
  };
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

  const ids: string[] = Array.isArray(body.prospectIds) ? body.prospectIds.map(String).filter(Boolean) : [];
  if (!ids.length) return NextResponse.json({ error: 'No prospects selected.' }, { status: 400 });
  if (ids.length > MAX_BATCH) {
    return NextResponse.json({ error: `Build at most ${MAX_BATCH} at a time.` }, { status: 400 });
  }

  const results: Array<Record<string, unknown>> = [];
  for (const id of ids) {
    const p = await getProspect(id);
    if (!p) {
      results.push({ prospectId: id, ok: false, error: 'not_found' });
      continue;
    }
    if (p.status === 'draft_built' && p.template_id) {
      results.push({ prospectId: id, ok: true, skipped: true, templateId: p.template_id });
      continue;
    }
    try {
      const listing = await listingForProspect(p);
      const built = await buildDraftFromListing({ listing, operatorId: operator.id });
      await markProspectBuilt(id, built.id);
      const hasMenu = built.summary.menuItems > 0;
      results.push({
        prospectId: id,
        ok: true,
        templateId: built.id,
        slug: built.slug,
        industryKey: built.industryKey,
        editorUrl: `/admin/templates/${built.id}`,
        claimUrl: `/claim-site/${built.id}?token=${encodeURIComponent(mintSiteClaimToken(built.id))}`,
        // 'auto' = a menu was read from photos; 'none' = built, but no menu (needs a
        // manual pass). Only meaningful for restaurants; other industries are 'n/a'.
        menuSource: built.industryKey === 'restaurant' ? (hasMenu ? 'auto' : 'none') : 'n/a',
        summary: built.summary,
      });
    } catch (e) {
      const msg = e instanceof BuildDraftError ? e.message : 'build_failed';
      results.push({ prospectId: id, ok: false, error: msg });
    }
  }

  const fresh = results.filter((r) => r.ok && !r.skipped);
  const builtCount = fresh.length;
  // Restaurant menu hit-rate for this batch — the number the CLI importer's tally
  // reports, surfaced to the operator so they can gauge the pipeline's yield.
  const restaurantResults = fresh.filter((r) => r.menuSource === 'auto' || r.menuSource === 'none');
  const menuHitRate = {
    auto: restaurantResults.filter((r) => r.menuSource === 'auto').length,
    none: restaurantResults.filter((r) => r.menuSource === 'none').length,
    total: restaurantResults.length,
  };
  return NextResponse.json({ ok: true, built: builtCount, menuHitRate, results });
}
