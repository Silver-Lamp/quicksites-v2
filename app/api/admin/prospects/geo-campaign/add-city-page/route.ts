// app/api/admin/prospects/geo-campaign/add-city-page/route.ts
//
// Generate a "<service> in <city>" landing subpage for a campaign's pitch site (a strong
// extra ranking surface that links back to the home page). Admin-gated. Idempotent.
//   POST { campaignId } | { templateId } -> { ok, changed, slug, reason? }

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getGeoCampaign, getGeoCampaignByTemplateId } from '@/lib/outreach/geoCampaigns';
import { addCityServicePage } from '@/lib/seo/localPagesServer';

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

  let campaign: { template_id: string | null; city: string | null; industry_key: string } | null = null;
  if (body.templateId) {
    const c = await getGeoCampaignByTemplateId(String(body.templateId));
    if (!c) return NextResponse.json({ error: 'This site is not a geo-domain pitch site.', code: 'not_geo_site' }, { status: 400 });
    campaign = { template_id: c.template_id, city: c.city, industry_key: c.industry_key };
  } else if (body.campaignId) {
    const c = await getGeoCampaign(String(body.campaignId));
    if (!c) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
    campaign = { template_id: c.template_id, city: c.city, industry_key: c.industry_key };
  } else {
    return NextResponse.json({ error: 'A campaignId or templateId is required.' }, { status: 400 });
  }

  const r = await addCityServicePage(campaign, operator.id);
  if (!r.ok) {
    const msg =
      r.reason === 'no_template' ? 'This campaign has no pitch site yet.' :
      r.reason === 'no_city' ? 'This campaign has no city set.' :
      r.reason || 'Could not add the page.';
    return NextResponse.json({ error: msg, code: r.reason }, { status: 400 });
  }
  return NextResponse.json(r);
}
