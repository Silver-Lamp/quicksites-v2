// lib/outreach/restaurantCompetition.ts
//
// Restaurant "domain competition" — a different geo model from the services land-grab
// (lib/outreach/geoCampaigns.ts). There, ONE exact-match domain fronts ONE shared pitch
// site that competitors race to claim, and the winner RENTS it.
//
// Here: a premium <city>-restaurant.com domain is the PRIZE for a cohort of no-website
// restaurants that each already got their OWN claimable delivered.menu ordering site.
// First to claim wins the apex — which points at a directory (Phase 2) that features the
// winner. The domain is a FREE traffic bonus; the money is the per-order take-rate. So the
// campaign carries no shared pitch site (template_id stays null) and is tagged
// kind='restaurant_competition' to keep it out of the services rent/pricing flows.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { provisionGeoDomain, linkProspectsToCampaign } from '@/lib/outreach/geoCampaigns';
import { geoDomainFor } from '@/lib/outreach/geoDomain';
import { getProspect } from '@/lib/outreach/prospects';

export const RESTAURANT_COMPETITION_KIND = 'restaurant_competition';

export type RestaurantCompetition = {
  id: string;
  domain: string;
  slug: string;
  city: string;
  region: string | null;
  domain_status: string;
};

export type CreateRestaurantCompetitionInput = {
  prospectIds: string[];
  createdBy: string;
  /** Override the derived <city>-restaurant.com (e.g. an already-owned domain). */
  domain?: string | null;
  region?: string | null;
};

export type CreateRestaurantCompetitionResult = {
  campaign: RestaurantCompetition;
  cohortSize: number;
};

/**
 * Create a restaurant domain-competition from a cohort of already-built no-website
 * restaurant drafts. Each selected prospect must have its own built ordering site
 * (`template_id`); the premium domain is bought/attached (register is flag-gated) and the
 * cohort is linked. No shared pitch site — the winner is decided by first claim.
 */
export async function createRestaurantCompetition(
  input: CreateRestaurantCompetitionInput,
): Promise<CreateRestaurantCompetitionResult> {
  const ids = Array.from(new Set(input.prospectIds.filter(Boolean)));
  if (ids.length < 2) throw new Error('A competition needs at least 2 restaurants.');

  const prospects = (await Promise.all(ids.map((id) => getProspect(id)))).filter(
    (p): p is NonNullable<typeof p> => !!p,
  );
  // Each competitor must already have its own ordering site (build them first).
  const built = prospects.filter((p) => p.template_id);
  if (built.length < 2) {
    throw new Error('Build the restaurant sites first — a competition needs 2+ with a site.');
  }

  const city = built.find((p) => p.city)?.city?.trim() || '';
  if (!city) throw new Error('Selected restaurants have no city — re-run discovery.');
  const region = input.region ?? built.find((p) => p.region)?.region ?? null;

  const derived = geoDomainFor(city, 'restaurant');
  const domain = (input.domain?.trim().toLowerCase() || derived.domain);
  const slug = derived.slug;

  // Guard against a duplicate competition for the same domain.
  const { data: existing } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id')
    .eq('domain', domain)
    .maybeSingle();
  if (existing?.id) throw new Error(`A campaign already exists for ${domain}.`);

  // Buy + attach the apex (registerDomain is flag-gated; an already-owned domain just attaches).
  const prov = await provisionGeoDomain(domain).catch(() => ({ status: 'planned' as string }));

  const { data, error } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .insert({
      kind: RESTAURANT_COMPETITION_KIND,
      city,
      region,
      country: 'US',
      industry_key: 'restaurant',
      domain,
      slug,
      template_id: null, // no shared pitch site; the apex will front a directory (Phase 2)
      domain_status: prov.status,
      status: 'draft',
      created_by: input.createdBy,
    })
    .select('id, domain, slug, city, region, domain_status')
    .single();
  if (error) throw new Error(`createRestaurantCompetition failed: ${error.message}`);

  await linkProspectsToCampaign(data.id, built.map((p) => p.id));

  return { campaign: data as RestaurantCompetition, cohortSize: built.length };
}

export type AwardResult = { campaignId: string; won: boolean };

/**
 * When a cohort restaurant draft is claimed, award the competition to that prospect —
 * ATOMICALLY, first-claim-wins: set the winner only if this is a restaurant competition
 * with no winner yet, then mark the other still-competing cohort prospects 'passed' (they
 * keep their own free ordering sites — they just don't get the apex). Idempotent +
 * best-effort (never throws). Returns null when the claimed template isn't part of any
 * competition; `{ won:false }` when it is but the contest was already decided (or a
 * concurrent claim won the race).
 */
export async function awardCompetitionOnClaim(templateId: string): Promise<AwardResult | null> {
  try {
    // claimed template → the prospect it was built for → its campaign
    const { data: prospect } = await supabaseAdmin
      .from('outreach_prospects')
      .select('id, geo_campaign_id')
      .eq('template_id', templateId)
      .not('geo_campaign_id', 'is', null)
      .maybeSingle();
    if (!prospect?.geo_campaign_id) return null;

    // Atomic compare-and-set: claim the apex only if this is a restaurant competition that
    // still has no winner. The kind filter guarantees we never touch a services campaign.
    const { data: won } = await supabaseAdmin
      .from('geo_industry_campaigns')
      .update({
        claimed_by_prospect_id: prospect.id,
        status: 'claimed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', prospect.geo_campaign_id)
      .eq('kind', RESTAURANT_COMPETITION_KIND)
      .is('claimed_by_prospect_id', null)
      .select('id')
      .maybeSingle();

    if (!won) return { campaignId: prospect.geo_campaign_id, won: false };

    // Runners-up: mark the other still-competing cohort prospects 'passed' (don't clobber
    // any already 'passed'/'dismissed' — only null → 'passed').
    await supabaseAdmin
      .from('outreach_prospects')
      .update({ waitlist_status: 'passed', updated_at: new Date().toISOString() })
      .eq('geo_campaign_id', won.id)
      .neq('id', prospect.id)
      .is('waitlist_status', null);

    return { campaignId: won.id, won: true };
  } catch (e) {
    console.error('[restaurant-competition] award on claim failed:', (e as any)?.message || e);
    return null;
  }
}
