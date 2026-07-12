// lib/outreach/competitionForSite.ts
//
// "Who will control this domain?" context for an unclaimed outreach site. When a geo
// campaign exists for the draft's template AND there's a real race (2+ competing
// businesses still in the running), we surface the competitors on the live site — the
// same first-to-claim-wins pressure the mailed poster uses, but on the site itself.
// Returns null when there's no campaign or no real contest, so the banner stays off.

import { getGeoCampaignByTemplateId } from '@/lib/outreach/geoCampaigns';
import { listProspectsByCampaign } from '@/lib/outreach/prospects';
import { KEY_TO_LABEL, type IndustryKey } from '@/lib/industries';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type SiteCompetition = {
  campaignId: string;
  domain: string;
  city: string;
  industryLabel: string;
  competitors: string[];
  /** When the first-to-claim window closes (ISO), for the live countdown. Null if unknown/expired. */
  deadlineIso: string | null;
};

/** Days a campaign's domain stays "up for grabs" from launch. Override with GEO_CLAIM_WINDOW_DAYS. */
function claimWindowDays(): number {
  const n = Number(process.env.GEO_CLAIM_WINDOW_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 14;
}

export async function getSiteCompetition(templateId: string): Promise<SiteCompetition | null> {
  const campaign = await getGeoCampaignByTemplateId(templateId);
  if (!campaign) return null;

  const prospects = await listProspectsByCampaign(campaign.id);
  const competitors = Array.from(
    new Set(
      prospects
        .filter((p) => p.status !== 'dismissed' && p.waitlist_status !== 'passed')
        .map((p) => p.business_name?.trim())
        .filter((n): n is string => !!n),
    ),
  );
  if (competitors.length < 2) return null; // not a real "race" without 2+

  // Countdown target = launch + claim window. A separate cheap query for created_at (not
  // in the shared summary type). Null if the window has already elapsed → the banner
  // shows "final call" urgency instead of a negative timer.
  let deadlineIso: string | null = null;
  const { data: meta } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('created_at')
    .eq('id', campaign.id)
    .maybeSingle();
  const createdAt = (meta as any)?.created_at;
  if (createdAt) {
    const end = new Date(createdAt).getTime() + claimWindowDays() * 86_400_000;
    if (end > Date.now()) deadlineIso = new Date(end).toISOString();
  }

  return {
    campaignId: campaign.id,
    domain: campaign.domain,
    city: campaign.city,
    industryLabel: KEY_TO_LABEL[campaign.industry_key as IndustryKey] ?? 'Local Services',
    competitors,
    deadlineIso,
  };
}
