// app/api/admin/prospects/auto-shop-competition/route.ts
//
// Create an auto-shop domain-competition from selected, already-built no-website auto shop
// prospects: buys/attaches a premium <city>-auto-repair.com apex and links the cohort. The
// first to claim their own QuickSites site wins the apex (awarded in the shared claim flow).
// Admin-gated. Thin wrapper over lib/outreach/autoShopCompetition.ts.
import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { createAutoShopCompetition } from '@/lib/outreach/autoShopCompetition';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // domain availability + Vercel attach

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const prospectIds: string[] = Array.isArray(body.prospectIds)
    ? body.prospectIds.map(String).filter(Boolean)
    : [];

  try {
    const r = await createAutoShopCompetition({
      prospectIds,
      createdBy: operator.id,
      domain: typeof body.domain === 'string' ? body.domain : undefined,
      region: typeof body.region === 'string' ? body.region : undefined,
    });
    return NextResponse.json({
      ok: true,
      campaignId: r.campaign.id,
      domain: r.campaign.domain,
      domainStatus: r.campaign.domain_status,
      cohortSize: r.cohortSize,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not create competition.' }, { status: 400 });
  }
}
