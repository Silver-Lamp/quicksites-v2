// app/api/admin/prospects/geo-campaign/set-winner/route.ts
//
// Record (or clear) the contest winner for a geo-domain campaign — the business that
// claimed the exclusive slot. The rest of the linked businesses become the runner-up
// waitlist (churn backfill). See docs/GEO_DOMAIN_MONETIZATION.md §5.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { setCampaignWinner } from '@/lib/outreach/geoCampaigns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const campaignId = String(body.campaignId ?? '');
  if (!campaignId) return NextResponse.json({ error: 'A campaignId is required.' }, { status: 400 });
  const prospectId = body.prospectId ? String(body.prospectId) : null;

  await setCampaignWinner(campaignId, prospectId);
  return NextResponse.json({ ok: true });
}
