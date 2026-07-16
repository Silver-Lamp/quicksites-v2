// app/r/[campaignId]/route.ts
//
// Tracked claim-link redirect for geo-campaign outreach (poster QR / postcard / SMS).
// Logs an intent visit (claim_link_visits) then 302s to the real tokenized claim URL —
// so "they opened the link" becomes a signal the next-action engine can use.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { mintSiteClaimToken } from '@/lib/auth/siteClaimToken';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';
import { resolveCampaignBrand } from '@/lib/outreach/campaignBrand';
import { recordScan } from '@/lib/outreach/mail/mailings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await ctx.params;
  const base = publicBaseUrl();
  // Per-prospect postcards carry ?p=<prospectId> so a scan attributes to that business.
  const prospectId = new URL(req.url).searchParams.get('p');

  const { data } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('template_id, claim_link_visits, org_id')
    .eq('id', campaignId)
    .maybeSingle();

  // Services campaigns claim the ONE shared pitch site (campaign.template_id). Restaurant
  // competitions have no shared site — each recipient claims their OWN restaurant site,
  // resolved from the per-prospect ?p=<prospectId> tag.
  let templateId = (data as any)?.template_id ?? null;
  if (!templateId && prospectId) {
    const { data: p } = await supabaseAdmin
      .from('outreach_prospects')
      .select('template_id')
      .eq('id', prospectId)
      .eq('geo_campaign_id', campaignId)
      .maybeSingle();
    templateId = (p as any)?.template_id ?? null;
  }
  if (!templateId) return NextResponse.redirect(base, 302);

  // Land the claim on the owning org's branded domain (falls back to quicksites.ai).
  const brand = await resolveCampaignBrand((data as any)?.org_id ?? null);

  // Best-effort intent counters (advisory): campaign total + per-prospect attribution.
  try {
    await supabaseAdmin
      .from('geo_industry_campaigns')
      .update({ claim_link_visits: ((data as any)?.claim_link_visits ?? 0) + 1 })
      .eq('id', campaignId);
    if (prospectId) await recordScan(campaignId, prospectId);
  } catch {
    /* counters are advisory */
  }

  const claimUrl = `${brand.baseUrl.replace(/\/+$/, '')}/claim-site/${templateId}?token=${encodeURIComponent(mintSiteClaimToken(templateId))}`;
  return NextResponse.redirect(claimUrl, 302);
}
