// lib/outreach/restaurantCompetitionDirectory.ts
//
// Loads the public directory that fronts a restaurant domain-competition apex
// (<city>-restaurant.com). The apex resolves via middleware → /sites/<slug>; when no
// template exists at that slug, the sites page falls back to this directory. Lists the
// cohort restaurants (each linking to its own delivered.menu / custom-domain site), with
// the competition WINNER featured first. Pure data assembly; the render is a server
// component. See [[restaurant-domain-competition]].

import { supabaseAdmin } from '@/lib/supabase/admin';
import { menuSiteUrl } from '@/lib/menu/deliveredMenu';
import { RESTAURANT_COMPETITION_KIND } from '@/lib/outreach/restaurantCompetition';
import { isBuffetLike } from '@/lib/prospects/orderingFit';
import { getHiddenTemplateIds, getExtraTemplateIds } from '@/lib/outreach/directoryCuration';

export type CompetitionDirectoryEntry = {
  templateId: string;
  slug: string;
  businessName: string;
  url: string;
  heroUrl: string | null;
  isWinner: boolean;
  published: boolean;
};

export type CompetitionDirectory = {
  campaignId: string;
  city: string;
  region: string | null;
  domain: string;
  hasWinner: boolean;
  entries: CompetitionDirectoryEntry[];
};

function safeParse(x: any): any {
  if (typeof x !== 'string') return x ?? {};
  try {
    return JSON.parse(x);
  } catch {
    return {};
  }
}

function heroFromData(data: any): string | null {
  const blocks = safeParse(data)?.pages?.[0]?.blocks ?? [];
  if (!Array.isArray(blocks)) return null;
  const hero = blocks.find((b: any) => b?.type === 'hero');
  const c = hero?.content ?? {};
  return c.image_url || c.background_url || c.imageUrl || null;
}

/** Load the competition directory for an apex slug, or null when it isn't one. */
export async function loadCompetitionDirectoryBySlug(slug: string): Promise<CompetitionDirectory | null> {
  const clean = (slug || '').trim().toLowerCase();
  if (!clean) return null;

  const { data: campaign } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, city, region, domain, claimed_by_prospect_id')
    .eq('kind', RESTAURANT_COMPETITION_KIND)
    .eq('slug', clean)
    .maybeSingle();
  if (!campaign) return null;
  return assembleDirectory(campaign);
}

/** Same directory, looked up by campaign id (the restaurants_directory block's key). */
export async function loadCompetitionDirectoryByCampaignId(campaignId: string): Promise<CompetitionDirectory | null> {
  const clean = (campaignId || '').trim();
  if (!clean) return null;

  const { data: campaign } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, city, region, domain, claimed_by_prospect_id')
    .eq('kind', RESTAURANT_COMPETITION_KIND)
    .eq('id', clean)
    .maybeSingle();
  if (!campaign) return null;
  return assembleDirectory(campaign);
}

async function assembleDirectory(campaign: {
  id: string;
  city: string;
  region: string | null;
  domain: string;
  claimed_by_prospect_id: string | null;
}): Promise<CompetitionDirectory> {
  const base: Omit<CompetitionDirectory, 'entries'> = {
    campaignId: campaign.id,
    city: campaign.city,
    region: campaign.region,
    domain: campaign.domain,
    hasWinner: !!campaign.claimed_by_prospect_id,
  };

  const { data: prospects } = await supabaseAdmin
    .from('outreach_prospects')
    .select('id, template_id, business_name')
    .eq('geo_campaign_id', campaign.id)
    .not('template_id', 'is', null);

  // Operator curation (lib/outreach/directoryCuration.ts). `extra` are restaurants pulled in
  // that aren't cohort members — they appear on the list without being enrolled in the
  // competition, because a storefront and a contest are different things.
  const [hidden, extra] = await Promise.all([
    getHiddenTemplateIds(campaign.id),
    getExtraTemplateIds(campaign.id),
  ]);
  const hiddenSet = new Set(hidden);

  const cohortIds = new Set((prospects ?? []).map((p: any) => p.template_id));
  const cohort = [
    ...(prospects ?? []),
    // Synthesised rows so extras flow through the same mapping as cohort members. No
    // prospect id, so they can never be mistaken for the competition winner.
    ...extra.filter((id) => !cohortIds.has(id)).map((id) => ({ id: null, template_id: id, business_name: null })),
  ];
  if (!cohort.length) return { ...base, entries: [] };

  const { data: templates } = await supabaseAdmin
    .from('templates')
    .select('id, slug, business_name, published, custom_domain, data')
    .in('id', cohort.map((p: any) => p.template_id));
  const tplById = new Map((templates ?? []).map((t: any) => [t.id, t]));

  const winnerProspectId = campaign.claimed_by_prospect_id;
  const entries: CompetitionDirectoryEntry[] = cohort
    .map((p: any) => {
      const t: any = tplById.get(p.template_id) ?? {};
      const tplSlug: string = t.slug ?? '';
      return {
        templateId: p.template_id,
        slug: tplSlug,
        businessName: t.business_name || p.business_name || tplSlug,
        url: t.custom_domain ? `https://${t.custom_domain}` : menuSiteUrl(tplSlug),
        heroUrl: heroFromData(t.data),
        isWinner: !!winnerProspectId && p.id === winnerProspectId,
        published: !!t.published,
      };
    })
    .filter((e) => e.slug)
    // MANUAL curation wins over the automatic rule, in both directions: an operator hide
    // removes anything, and an operator "add" (extra) keeps a restaurant the buffet rule
    // would otherwise drop. A rule that can't be overridden is a rule you fight.
    .filter((e) => !hiddenSet.has(e.templateId))
    // A buffet is a dine-in model — nobody phones one for takeaway — so it is the wrong fit
    // for an ORDERING directory, and the take-rate funnel behind it has no orders to bite on.
    // Filtered here as well as in the commit-time snapshot so the live feed and the snapshot
    // can never disagree about who is on the list. See lib/prospects/orderingFit.ts.
    .filter((e) => {
      if (extra.includes(e.templateId)) return true; // deliberate operator override
      const t: any = tplById.get(e.templateId) ?? {};
      return !isBuffetLike({
        name: e.businessName,
        categories: t?.data?.meta?.services ?? t?.data?.services ?? [],
      });
    });

  // Winner first, then published, then alphabetical.
  entries.sort(
    (a, b) =>
      Number(b.isWinner) - Number(a.isWinner) ||
      Number(b.published) - Number(a.published) ||
      a.businessName.localeCompare(b.businessName),
  );

  return { ...base, entries };
}
