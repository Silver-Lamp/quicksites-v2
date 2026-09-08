// app/go/[prospectId]/route.ts
//
// Tracked claim link for a per-business draft (the trade-site claim postcard's QR). Counts the
// visit on the prospect, mints a FRESH claim token, and 302s to the claim page — so the printed
// link carries no bearer token and "they opened the card" becomes a number.
//
// Once the site is claimed the same link sends the visitor to the live site: a card lands days
// after it was mailed, and the owner may have claimed from a different device by then.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { mintSiteClaimToken } from '@/lib/auth/siteClaimToken';
import { resolveCampaignBrand, defaultOutreachOrgSlug } from '@/lib/outreach/campaignBrand';
import { publicSiteUrl } from '@/lib/sites/publicUrl';
import { tradeSiteBaseUrl } from '@/lib/tradeSites/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ prospectId: string }> }) {
  const { prospectId } = await ctx.params;
  // Same host rule as the card: a branded org lands on its own host, the default on www.quicksites.ai.
  const base = defaultOutreachOrgSlug() ? (await resolveCampaignBrand(null)).baseUrl.replace(/\/+$/, '') : tradeSiteBaseUrl();

  const { data: p } = await (supabaseAdmin as any)
    .from('outreach_prospects')
    .select('id, template_id, claim_link_visits')
    .eq('id', prospectId)
    .maybeSingle();
  if (!p?.template_id) return NextResponse.redirect(base, 302);

  try {
    await (supabaseAdmin as any)
      .from('outreach_prospects')
      .update({ claim_link_visits: (p.claim_link_visits ?? 0) + 1, claim_link_visited_at: new Date().toISOString() })
      .eq('id', prospectId);
  } catch { /* the counter is advisory */ }

  const { data: t } = await supabaseAdmin
    .from('templates')
    .select('id, slug, custom_domain, claim_source')
    .eq('id', p.template_id)
    .maybeSingle();
  if (!t) return NextResponse.redirect(base, 302);

  if ((t as any).claim_source === 'listing_import') {
    return NextResponse.redirect(`${base}/claim-site/${t.id}?token=${encodeURIComponent(mintSiteClaimToken(t.id))}`, 302);
  }
  return NextResponse.redirect(publicSiteUrl({ custom_domain: (t as any).custom_domain, slug: (t as any).slug }) ?? base, 302);
}
