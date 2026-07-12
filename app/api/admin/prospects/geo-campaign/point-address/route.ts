// app/api/admin/prospects/geo-campaign/point-address/route.ts
//
// On-demand "point this org-branded site at the org's service area" — the Growth Coach's
// automated address step. Admin-gated. No-op when the site already has its own address.
//   POST { campaignId } -> { ok, changed, label, reason }
// See lib/outreach/pointCampaignAddress.ts + docs/RANKED_TARGETING_PLAN.md.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getGeoCampaign } from '@/lib/outreach/geoCampaigns';
import { pointCampaignAtOrgServiceArea } from '@/lib/outreach/pointCampaignAddress';

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

  const campaign = await getGeoCampaign(campaignId);
  if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
  if (!campaign.org_id) {
    return NextResponse.json({ error: 'Brand this campaign to an org first.', code: 'no_org' }, { status: 400 });
  }

  const r = await pointCampaignAtOrgServiceArea(campaign, operator.id);
  if (!r.ok && r.reason === 'no_org_address') {
    return NextResponse.json({ error: 'That org has no service-area address or contact email set (add one on /admin/org).', code: 'no_org_identity' }, { status: 400 });
  }
  if (!r.ok) return NextResponse.json({ error: r.reason || 'Could not update the site.' }, { status: 500 });
  return NextResponse.json(r);
}
