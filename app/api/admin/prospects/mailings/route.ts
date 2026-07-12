// app/api/admin/prospects/mailings/route.ts
//
// Postcard delivery-status roll-up per geo campaign, for the prospects admin surfaces
// (row badges + the poster status panel). Admin-gated, read-only. Pass ?ids=a,b,c to
// scope to specific campaigns.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { mailingSummaryForCampaigns } from '@/lib/outreach/mail/mailings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const ids = (new URL(req.url).searchParams.get('ids') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!ids.length) return NextResponse.json({ ok: true, byCampaign: {} });

  const byCampaign = await mailingSummaryForCampaigns(ids);
  return NextResponse.json({ ok: true, byCampaign });
}
