// app/api/admin/prospects/build/route.ts
//
// Selectively build draft sites for chosen prospects. This is where AI is spent (menu
// OCR for restaurants), only for the businesses the operator picks — the "build" half
// of discover-then-selective-build. Reuses the shared listing→draft builder, so each
// draft lands in /admin/outreach with the same claim/QR flow.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getProspect, markProspectBuilt } from '@/lib/outreach/prospects';
import { buildDraftFromListing, BuildDraftError } from '@/lib/outreach/buildDraftFromListing';
import { mintSiteClaimToken } from '@/lib/auth/siteClaimToken';
import type { Listing } from '@/lib/rebuild/importListing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // vision OCR for restaurant prospects

const MAX_BATCH = 10; // cap synchronous builds per request (AI cost + serverless time)

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
    const listing: Listing = {
      name: p.business_name,
      phone: p.phone ?? undefined,
      address: p.address ?? undefined,
      website: p.website,
      categories: p.categories ?? [],
    };
    try {
      const built = await buildDraftFromListing({ listing, operatorId: operator.id });
      await markProspectBuilt(id, built.id);
      results.push({
        prospectId: id,
        ok: true,
        templateId: built.id,
        slug: built.slug,
        industryKey: built.industryKey,
        editorUrl: `/admin/templates/${built.id}`,
        claimUrl: `/claim-site/${built.id}?token=${encodeURIComponent(mintSiteClaimToken(built.id))}`,
        summary: built.summary,
      });
    } catch (e) {
      const msg = e instanceof BuildDraftError ? e.message : 'build_failed';
      results.push({ prospectId: id, ok: false, error: msg });
    }
  }

  const builtCount = results.filter((r) => r.ok && !r.skipped).length;
  return NextResponse.json({ ok: true, built: builtCount, results });
}
