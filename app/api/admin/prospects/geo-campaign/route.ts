// app/api/admin/prospects/geo-campaign/route.ts
//
// Launch a location-industry domain campaign from a "competition card": a city +
// industry where several businesses have no website. Mints boston-towing.com (checks
// availability, optionally registers — flag-gated — and attaches to Vercel), stands up
// ONE claimable pitch site whose slug == the domain apex label, links the competing
// prospects, and returns the campaign so the operator can pitch it. First business to
// claim gets the domain; QuickSites keeps it.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { toIndustryKey, type IndustryKey } from '@/lib/industries';
import {
  geoDomainFor,
  buildGeoPitchSite,
  provisionGeoDomain,
  createGeoCampaign,
  linkProspectsToCampaign,
} from '@/lib/outreach/geoCampaigns';
import { mintSiteClaimToken } from '@/lib/auth/siteClaimToken';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // domain availability/registration + Vercel attach

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const city = String(body.city ?? '').trim();
  const region = body.region ? String(body.region).trim() : null;
  const industryKey: IndustryKey = toIndustryKey(String(body.industryKey ?? body.industry ?? ''));
  const prospectIds: string[] = Array.isArray(body.prospectIds) ? body.prospectIds.map(String).filter(Boolean) : [];
  const tld = typeof body.tld === 'string' && /^[a-z]{2,}$/i.test(body.tld) ? body.tld.toLowerCase() : 'com';

  if (!city) return NextResponse.json({ error: 'A city is required.' }, { status: 400 });
  if (industryKey === 'other') {
    return NextResponse.json({ error: 'A specific industry is required for the domain.' }, { status: 400 });
  }

  const { domain, slug } = geoDomainFor(city, industryKey, tld);

  // 1) Build the claimable pitch site (slug must equal the apex label).
  let pitch;
  try {
    pitch = await buildGeoPitchSite({ city, region, industryKey, slug, operatorId: operator.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not create the pitch site.', domain, slug }, { status: 409 });
  }

  // 2) Provision the domain (availability → register [flag-gated] → attach). Best-effort.
  const provisioned = await provisionGeoDomain(domain);

  // 3) Record the campaign + link the competing prospects.
  let campaign;
  try {
    campaign = await createGeoCampaign({
      city,
      region,
      country: body.country ?? null,
      centerLat: Number.isFinite(body.lat) ? Number(body.lat) : null,
      centerLon: Number.isFinite(body.lon) ? Number(body.lon) : null,
      industryKey,
      domain,
      slug,
      templateId: pitch.templateId,
      domainStatus: provisioned.status,
      createdBy: operator.id,
    });
    await linkProspectsToCampaign(campaign.id, prospectIds);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Pitch site built but campaign record failed.', templateId: pitch.templateId, domain },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    campaign,
    domain,
    slug,
    domainStatus: provisioned.status,
    domainDetail: provisioned.detail ?? null,
    templateId: pitch.templateId,
    editorUrl: `/admin/templates/${pitch.templateId}`,
    claimUrl: `/claim-site/${pitch.templateId}?token=${encodeURIComponent(mintSiteClaimToken(pitch.templateId))}`,
    pitchedProspects: prospectIds.length,
  });
}
