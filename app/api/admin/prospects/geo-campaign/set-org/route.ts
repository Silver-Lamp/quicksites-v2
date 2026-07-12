// app/api/admin/prospects/geo-campaign/set-org/route.ts
//
// Switch (or clear) a geo campaign's owning org. The org brands every prospect-facing
// surface — postcard, claim page, tracked links, emails — so this is how you make a
// campaign present as "CedarSites" instead of the QuickSites default. Admin-gated.
// Body: { campaignId, orgSlug?: string, orgId?: string, clear?: true }.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getGeoCampaign, setCampaignOrg } from '@/lib/outreach/geoCampaigns';
import { orgIdForSlug, resolveCampaignBrand } from '@/lib/outreach/campaignBrand';
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

  let orgId: string | null = null;
  if (!body.clear) {
    if (body.orgId) {
      orgId = String(body.orgId);
    } else if (body.orgSlug) {
      orgId = await orgIdForSlug(String(body.orgSlug));
      if (!orgId) return NextResponse.json({ error: `No org found for slug "${body.orgSlug}".` }, { status: 404 });
    } else {
      return NextResponse.json({ error: 'Pass an orgSlug/orgId, or clear:true to reset to QuickSites.' }, { status: 400 });
    }
  }

  await setCampaignOrg(campaignId, orgId);

  // Auto-point the pitch site at the org's service area (best-effort; only when the org has
  // an address set + the site has none of its own). See lib/outreach/pointCampaignAddress.ts.
  let addressPointed: { changed: boolean; label?: string } | null = null;
  if (orgId) {
    try {
      const r = await pointCampaignAtOrgServiceArea({ template_id: campaign.template_id, org_id: orgId }, operator.id);
      if (r.ok) addressPointed = { changed: r.changed, label: r.label };
    } catch {
      /* branding still succeeds even if seeding fails */
    }
  }

  const brand = await resolveCampaignBrand(orgId);
  return NextResponse.json({ ok: true, orgId, brand: { name: brand.name, baseUrl: brand.baseUrl }, addressPointed });
}
