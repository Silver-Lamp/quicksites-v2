// app/api/admin/prospects/geo-campaign/recompute-recs/route.ts
//
// On-demand "Recompute recommendations" for geo-domain campaigns. The daily
// geo-rank-sync cron normally populates each campaign's `recommendations` jsonb, so a
// freshly launched campaign shows an empty "next steps" panel until the cron next runs.
// This lets an operator recompute from already-stored signals (no fresh GSC fetch) —
// one campaign (`campaignId`) or every campaign when the body is empty.
// See docs/GEO_RECOMMENDATIONS_PLAN.md.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getGeoCampaign, listGeoCampaigns } from '@/lib/outreach/geoCampaigns';
import { recomputeCampaignRecommendations } from '@/lib/outreach/computeRecommendations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Empty/invalid body = recompute all campaigns.
  }
  const campaignId = body?.campaignId ? String(body.campaignId) : null;

  let campaigns;
  if (campaignId) {
    const one = await getGeoCampaign(campaignId);
    if (!one) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
    campaigns = [one];
  } else {
    campaigns = await listGeoCampaigns(500);
  }

  let recced = 0;
  let failed = 0;
  for (const c of campaigns) {
    try {
      await recomputeCampaignRecommendations(c);
      recced += 1;
    } catch {
      failed += 1; // best-effort — recommendations are advisory
    }
  }

  return NextResponse.json({ ok: true, recced, failed });
}
