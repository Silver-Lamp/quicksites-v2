// app/api/admin/prospects/geo-campaign/generate-blog/route.ts
//
// Generate unique, LLM-written blog posts (as pages) for a geo pitch site, each linking
// back to the site's own pages. Admin-gated + metered + flag-gated (GEO_RECS_LLM_ENABLED,
// so we never mass-produce duplicate content). Modes:
//   POST { campaignId | templateId, count? }  → one site
//   POST { backfill: true, perSite?, limit? }  → many sites (bounded)

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getGeoCampaign, getGeoCampaignByTemplateId, listGeoCampaigns } from '@/lib/outreach/geoCampaigns';
import { generateBlogPosts, backfillBlogPosts } from '@/lib/seo/blogPostsServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120; // several metered chat calls back-to-back

function reasonToMessage(reason?: string): string {
  switch (reason) {
    case 'llm_disabled': return 'Blog generation is off — set GEO_RECS_LLM_ENABLED=1 and OPENAI_API_KEY.';
    case 'no_template': return 'This campaign has no pitch site yet.';
    case 'no_city': return 'This campaign has no city set.';
    case 'nothing_to_add': return 'Blog posts already exist for this site.';
    default: return reason || 'Could not generate blog posts.';
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

  if (body.backfill === true) {
    const perSite = Number.isFinite(body.perSite) ? Number(body.perSite) : 2;
    const limit = Number.isFinite(body.limit) ? Number(body.limit) : 15;
    const campaigns = (await listGeoCampaigns()).filter((c) => c.status !== 'archived' && c.template_id && c.city);
    const r = await backfillBlogPosts(campaigns, operator.id, { perSite, limit });
    return NextResponse.json({ ok: true, ...r });
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

  const count = Number.isFinite(body.count) ? Number(body.count) : undefined;
  const r = await generateBlogPosts(campaign, operator.id, { count });
  if (!r.ok) {
    const status = r.reason === 'llm_disabled' ? 400 : 400;
    return NextResponse.json({ error: reasonToMessage(r.reason), code: r.reason }, { status });
  }
  return NextResponse.json(r);
}
