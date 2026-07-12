// app/r/[campaignId]/route.ts
//
// Tracked claim-link redirect for geo-campaign outreach (poster QR / postcard / SMS).
// Logs an intent visit (claim_link_visits) then 302s to the real tokenized claim URL —
// so "they opened the link" becomes a signal the next-action engine can use.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { mintSiteClaimToken } from '@/lib/auth/siteClaimToken';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await ctx.params;
  const base = publicBaseUrl();

  const { data } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('template_id, claim_link_visits')
    .eq('id', campaignId)
    .maybeSingle();
  const templateId = (data as any)?.template_id;
  if (!templateId) return NextResponse.redirect(base, 302);

  // Best-effort intent counter (advisory).
  try {
    await supabaseAdmin
      .from('geo_industry_campaigns')
      .update({ claim_link_visits: ((data as any)?.claim_link_visits ?? 0) + 1 })
      .eq('id', campaignId);
  } catch {
    /* counter is advisory */
  }

  const claimUrl = `${base}/claim-site/${templateId}?token=${encodeURIComponent(mintSiteClaimToken(templateId))}`;
  return NextResponse.redirect(claimUrl, 302);
}
