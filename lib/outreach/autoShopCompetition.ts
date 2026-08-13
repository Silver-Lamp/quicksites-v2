// lib/outreach/autoShopCompetition.ts
//
// Auto-shop "domain competition" — the restaurant-competition model applied to auto
// service (docs: SECONDSET_GLASSES_PLAN.md is the product tie-in). A premium
// <city>-auto-repair.com apex is the PRIZE for a cohort of no-website auto shops that each
// already got their own claimable QuickSites site (SecondSet-forward). First to claim wins
// the apex, which fronts a public directory that features the winner as "the shop that
// shows you the work." The domain is a free traffic bonus; the money is the SecondSet
// subscription + take-rate. Shares the first-to-claim award hook with restaurants via
// lib/outreach/competitionKinds.ts (awardCompetitionOnClaim is kind-agnostic).

import { supabaseAdmin } from '@/lib/supabase/admin';
import { provisionGeoDomain, linkProspectsToCampaign } from '@/lib/outreach/geoCampaigns';
import { geoDomainFor, apexSlugForDomain } from '@/lib/outreach/geoDomain';
import { getProspect } from '@/lib/outreach/prospects';
import { AUTO_SHOP_COMPETITION_KIND } from '@/lib/outreach/competitionKinds';

/** The industry the auto-shop competition targets (drives the domain word + poster copy). */
export const AUTO_SHOP_INDUSTRY_KEY = 'auto_repair';

export type AutoShopCompetition = {
  id: string;
  domain: string;
  slug: string;
  city: string;
  region: string | null;
  domain_status: string;
};

export type CreateAutoShopCompetitionInput = {
  prospectIds: string[];
  createdBy: string;
  /** Override the derived <city>-auto-repair.com (e.g. an already-owned domain). */
  domain?: string | null;
  region?: string | null;
};

export type CreateAutoShopCompetitionResult = {
  campaign: AutoShopCompetition;
  cohortSize: number;
};

/**
 * Create an auto-shop domain-competition from a cohort of already-built no-website auto
 * shop drafts. Each selected prospect must have its own built site (`template_id`); the
 * premium <city>-auto-repair.com is bought/attached (register is flag-gated) and the cohort
 * is linked. No shared pitch site — the winner is decided by first claim. The apex directory
 * portal is stood up best-effort (buildAutoShopApexSite).
 */
export async function createAutoShopCompetition(
  input: CreateAutoShopCompetitionInput,
): Promise<CreateAutoShopCompetitionResult> {
  const ids = Array.from(new Set(input.prospectIds.filter(Boolean)));
  if (ids.length < 2) throw new Error('A competition needs at least 2 auto shops.');

  const prospects = (await Promise.all(ids.map((id) => getProspect(id)))).filter(
    (p): p is NonNullable<typeof p> => !!p,
  );
  const built = prospects.filter((p) => p.template_id);
  if (built.length < 2) {
    throw new Error('Build the auto-shop sites first — a competition needs 2+ with a site.');
  }

  const city = built.find((p) => p.city)?.city?.trim() || '';
  if (!city) throw new Error('Selected auto shops have no city — re-run discovery.');
  const region = input.region ?? built.find((p) => p.region)?.region ?? null;

  const derived = geoDomainFor(city, AUTO_SHOP_INDUSTRY_KEY);
  const domain = input.domain?.trim().toLowerCase() || derived.domain;
  // ⚠️ Same fix as the restaurant path: derive the apex label from the domain we actually bought.
  // `derived.slug` ignores the override, so any campaign launched on a non-canonical domain pointed
  // at a slug nothing creates. Found while fixing the restaurant side — this one has no
  // plural-preferring search in front of it yet, so it was latent rather than live.
  const slug = apexSlugForDomain(domain);

  const { data: existing } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id')
    .eq('domain', domain)
    .maybeSingle();
  if (existing?.id) throw new Error(`A campaign already exists for ${domain}.`);

  const prov = await provisionGeoDomain(domain).catch(() => ({ status: 'planned' as string }));

  const { data, error } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .insert({
      kind: AUTO_SHOP_COMPETITION_KIND,
      city,
      region,
      country: 'US',
      industry_key: AUTO_SHOP_INDUSTRY_KEY,
      domain,
      slug,
      template_id: null, // no shared pitch site; the apex fronts a directory
      domain_status: prov.status,
      status: 'draft',
      created_by: input.createdBy,
    })
    .select('id, domain, slug, city, region, domain_status')
    .single();
  if (error) throw new Error(`createAutoShopCompetition failed: ${error.message}`);

  await linkProspectsToCampaign(data.id, built.map((p) => p.id));

  // NOTE: the apex directory portal (buildAutoShopApexSite) is wired in the next increment
  // alongside the auto_shops_directory block. The competition + cohort link + first-to-claim
  // award (shared awardCompetitionOnClaim) are fully functional now.

  return { campaign: data as AutoShopCompetition, cohortSize: built.length };
}
