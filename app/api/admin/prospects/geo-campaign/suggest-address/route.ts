// app/api/admin/prospects/geo-campaign/suggest-address/route.ts
//
// Suggest (and optionally apply) a plausible default office address for a geo pitch site,
// grounded in the campaign's city + trade. Admin-gated + metered + flag-gated
// (GEO_RECS_LLM_ENABLED). Three modes:
//   POST { campaignId, apply?, force? }  → single campaign
//   POST { templateId, apply?, force? }  → single, resolved from the editor's template
//   POST { backfill: true, limit? }      → fill every address-less pitch site (bounded)
// See lib/outreach/domainOfficeAddress.ts.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getGeoCampaign, getGeoCampaignByTemplateId, listGeoCampaigns } from '@/lib/outreach/geoCampaigns';
import { suggestAndApplyOfficeAddress, backfillOfficeAddresses } from '@/lib/outreach/domainOfficeAddress';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DISABLED = { error: 'Address suggestions are off — set GEO_RECS_LLM_ENABLED=1 and OPENAI_API_KEY.', code: 'llm_disabled' };

function reasonToMessage(reason?: string): string {
  switch (reason) {
    case 'llm_disabled': return DISABLED.error;
    case 'no_template': return 'This campaign has no pitch site yet.';
    case 'no_suggestion': return "Couldn't generate an address — try again.";
    case 'already_has_address': return 'Site already has an address — nothing changed.';
    default: return reason || 'Could not update the site.';
  }
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

  const apply = body.apply !== false; // default true
  const force = body.force === true;

  // ── Bulk backfill ──────────────────────────────────────────────────────────
  if (body.backfill === true) {
    const limit = Number.isFinite(body.limit) ? Number(body.limit) : 25;
    const campaigns = (await listGeoCampaigns()).filter((c) => c.status !== 'archived' && c.template_id && c.city);
    const r = await backfillOfficeAddresses(campaigns, operator.id, { limit });
    return NextResponse.json({ ok: true, ...r });
  }

  // ── Single campaign (by campaignId or the editor's templateId) ──────────────
  let campaign:
    | { id: string; template_id: string | null; domain: string; city: string | null; region: string | null; industry_key: string }
    | null = null;

  if (body.templateId) {
    const c = await getGeoCampaignByTemplateId(String(body.templateId));
    if (!c) return NextResponse.json({ error: 'This site is not a geo-domain pitch site.', code: 'not_geo_site' }, { status: 400 });
    campaign = { id: c.id, template_id: c.template_id, domain: c.domain, city: c.city, region: null, industry_key: c.industry_key };
  } else if (body.campaignId) {
    const c = await getGeoCampaign(String(body.campaignId));
    if (!c) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
    campaign = { id: c.id, template_id: c.template_id, domain: c.domain, city: c.city, region: c.region, industry_key: c.industry_key };
  } else {
    return NextResponse.json({ error: 'A campaignId or templateId is required.' }, { status: 400 });
  }

  const r = await suggestAndApplyOfficeAddress(campaign as any, operator.id, { apply, force });
  if (!r.ok) {
    const status = r.reason === 'llm_disabled' ? 400 : r.reason === 'no_suggestion' ? 502 : 400;
    return NextResponse.json({ error: reasonToMessage(r.reason), code: r.reason }, { status });
  }
  return NextResponse.json(r);
}
