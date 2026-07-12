// lib/outreach/computeRecommendations.ts
//
// Gather a geo-campaign's signals (on-page, GSC rank, reviews, calls, outreach history)
// → run both recommendation engines → store the result on the campaign. Called from the
// geo-rank-sync cron. See docs/GEO_RECOMMENDATIONS_PLAN.md.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { analyzeOnPage } from '@/lib/outreach/onPage';
import { buildRankingRecommendations } from '@/lib/outreach/recommendations';
import { nextOutreachAction } from '@/lib/outreach/nextAction';
import { fetchPlaceDetails, placeDetailsConfigured } from '@/lib/places/placeDetails';
import { postcardMailEnabled } from '@/lib/outreach/mail/lob';
import { prospectSmsEnabled } from '@/lib/outreach/sms/outreachSms';
import { synthesizeTopThree } from '@/lib/outreach/synthesizeRecs';
import { KEY_TO_LABEL, type IndustryKey } from '@/lib/industries';
import type { GeoCampaign } from '@/lib/outreach/geoCampaigns';
import type { RankTrend } from '@/lib/outreach/rankTrend';

const SIGNAL_TTL_MS = 7 * 86_400_000; // refresh GBP place signals weekly (paid SKU)

function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) >= new Date(b) ? a : b;
}

/** Compute + store recommendations for one campaign. Best-effort; never throws fatally. */
export async function computeCampaignRecommendations(
  campaign: GeoCampaign,
  opts?: { impressions?: number | null; trend?: RankTrend | null },
): Promise<void> {
  // 1) Pitch site on-page signals.
  let onPageData: any = {};
  if (campaign.template_id) {
    const { data } = await supabaseAdmin.from('templates').select('data').eq('id', campaign.template_id).maybeSingle();
    onPageData = (data as any)?.data ?? {};
  }
  const onPage = analyzeOnPage(onPageData);

  // 2) Roster (competition + winner) with outreach history + GBP signals.
  const { data: rosterRaw } = await supabaseAdmin
    .from('outreach_prospects')
    .select('id, place_id, phone, address, rating, review_count, place_signals_synced_at, postcard_sent_at, sms_sent_at')
    .eq('geo_campaign_id', campaign.id);
  const roster = (rosterRaw as any[]) ?? [];

  // 3) Throttled GBP refresh (rating/review_count) for stale roster rows.
  if (placeDetailsConfigured()) {
    const now = Date.now();
    for (const p of roster) {
      const stale = !p.place_signals_synced_at || now - new Date(p.place_signals_synced_at).getTime() > SIGNAL_TTL_MS;
      if (!stale || !p.place_id) continue;
      const sig = await fetchPlaceDetails(p.place_id);
      if (!sig) continue;
      p.rating = sig.rating;
      p.review_count = sig.reviewCount;
      await supabaseAdmin
        .from('outreach_prospects')
        .update({ rating: sig.rating, review_count: sig.reviewCount, place_signals_synced_at: new Date().toISOString() })
        .eq('id', p.id);
    }
  }

  // 4) Call count.
  const { count: callCount } = await supabaseAdmin
    .from('call_logs')
    .select('call_sid', { count: 'exact', head: true })
    .eq('geo_campaign_id', campaign.id);

  // 5) Derive review benchmark (winner vs. top competitors).
  const winner = roster.find((p) => p.id === campaign.claimed_by_prospect_id);
  const competitors = roster.filter((p) => p.id !== campaign.claimed_by_prospect_id);
  const topReviews = competitors
    .map((p) => (typeof p.review_count === 'number' ? p.review_count : null))
    .filter((n): n is number => n != null)
    .sort((a, b) => b - a)
    .slice(0, 3);
  const competitorTopReviewAvg = topReviews.length ? topReviews.reduce((a, b) => a + b, 0) / topReviews.length : null;

  const ranking = buildRankingRecommendations({
    industryKey: campaign.industry_key,
    rankStatus: campaign.rank_status,
    rankPosition: campaign.rank_position,
    impressions: opts?.impressions ?? null,
    callCount: callCount ?? 0,
    hasTrackingNumber: !!campaign.tracking_number,
    reviewCount: winner ? winner.review_count ?? null : null,
    rating: winner ? winner.rating ?? null : null,
    competitorTopReviewAvg,
    onPage,
    pricingModel: campaign.pricing_model,
    subscriptionStatus: campaign.subscription_status,
    trend: opts?.trend ?? null,
  });

  const nextAction = nextOutreachAction({
    now: Date.now(),
    draftBuiltAt: null,
    lastPostcardAt: roster.reduce<string | null>((acc, p) => maxIso(acc, p.postcard_sent_at ?? null), null),
    lastSmsAt: roster.reduce<string | null>((acc, p) => maxIso(acc, p.sms_sent_at ?? null), null),
    claimed: !!campaign.claimed_by_prospect_id,
    subscriptionStatus: campaign.subscription_status,
    callCount: callCount ?? 0,
    claimVisits: (campaign as any).claim_link_visits ?? 0,
    rankStatus: campaign.rank_status,
    channels: { mail: postcardMailEnabled(), sms: prospectSmsEnabled() },
    hasPhone: roster.some((p) => !!p.phone),
    hasAddress: roster.some((p) => !!p.address),
    hasEmail: false, // Places gives no email for cold prospects
  });

  // Optional LLM top-3 synthesis (grounded in the rules above; null when disabled/fails).
  // Gated to PREMIUM campaigns (a paying renter) — the deterministic ranking/nextAction
  // stay free for every campaign; only the AI polish is a paid perk. Saves LLM spend.
  const isPremiumCampaign = campaign.subscription_status === 'active';
  const summary = isPremiumCampaign
    ? await synthesizeTopThree({
        domain: campaign.domain,
        city: campaign.city,
        industryLabel: KEY_TO_LABEL[campaign.industry_key as IndustryKey] ?? campaign.industry_key,
        ranking,
        nextAction,
      }).catch(() => null)
    : null;

  await supabaseAdmin
    .from('geo_industry_campaigns')
    .update({ recommendations: { ranking, nextAction, summary }, recommendations_synced_at: new Date().toISOString() })
    .eq('id', campaign.id);
}

/**
 * On-demand recompute from already-stored signals (no fresh GSC fetch). Reuses the
 * campaign's persisted rank + trend and the last logged impressions from
 * `geo_rank_history`, so an operator can populate/refresh the "next steps" panel
 * immediately instead of waiting for the daily geo-rank-sync cron. Best-effort.
 */
export async function recomputeCampaignRecommendations(campaign: GeoCampaign): Promise<void> {
  const { data: last } = await supabaseAdmin
    .from('geo_rank_history')
    .select('impressions')
    .eq('campaign_id', campaign.id)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  await computeCampaignRecommendations(campaign, {
    impressions: (last as any)?.impressions ?? null,
    trend: (campaign as any).rank_trend ?? null,
  });
}
