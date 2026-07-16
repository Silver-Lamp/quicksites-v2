// lib/outreach/restaurantDomains.ts
//
// "Restaurant Location Domains" — the admin cockpit view that joins the three legs of
// the restaurant claim-contest funnel (see lib/outreach/restaurantCompetition.ts):
//   1. the <city>-restaurant.com domains we own (owned_domains + campaign rows),
//   2. the no-website restaurants discovered in each area (outreach_prospects),
//   3. the competition each cohort is racing in (geo_industry_campaigns,
//      kind='restaurant_competition') with per-prospect funnel links (tracked claim
//      links, delivered.menu draft sites, the apex directory).
//
// assembleRestaurantDomainAreas() is pure (rows in → areas out, link builders injected)
// so the grouping is testable; getRestaurantLocationDomains() is the I/O wrapper the
// admin route calls.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { menuSiteUrl } from '@/lib/menu/deliveredMenu';
import { geoDomainFor } from '@/lib/outreach/geoDomain';
import { normalizeDomain, domainLabelKey } from '@/lib/prospects/ownedDomains';
import { claimUrlFor, trackedClaimUrl } from '@/lib/outreach/competitionPoster';
import { linkProspectsToCampaign } from '@/lib/outreach/geoCampaigns';
import { RESTAURANT_COMPETITION_KIND } from '@/lib/outreach/restaurantCompetition';

// ---- Wire types ---------------------------------------------------------------

export type AreaRestaurant = {
  id: string;
  business_name: string;
  phone: string | null;
  address: string | null;
  status: string; // discovered | draft_built | claimed | dismissed
  template_id: string | null;
  published: boolean;
  /** The restaurant's own ordering-site URL (custom domain or delivered.menu). */
  site_url: string | null;
  /** The funnel entry link for THIS restaurant (tracked when in a contest). */
  claim_url: string | null;
  is_winner: boolean;
  waitlist_status: string | null;
};

export type RestaurantDomainArea = {
  key: string;
  domain: string; // owned or derived <city>-restaurant.com apex
  domain_owned: boolean;
  domain_status: string | null; // campaign domain_status when a contest exists
  directory_url: string | null; // https://<domain> (the apex directory) when a contest exists
  city: string;
  region: string | null;
  campaign_id: string | null;
  campaign_status: string | null; // draft | live | claimed
  /** 'restaurant_competition' = claim contest; 'geo_services' = rent-model campaign
   *  that targeted restaurants (pre-contest era) — convertible via /convert. */
  campaign_kind: string | null;
  has_winner: boolean;
  winner_name: string | null;
  /** Cohort racing for the apex (linked to the campaign). */
  competitors: AreaRestaurant[];
  /** No-website restaurants in the area NOT yet in the contest. */
  candidates: AreaRestaurant[];
};

export type RestaurantDomainOverview = {
  areas: RestaurantDomainArea[];
  totals: {
    domains_owned: number;
    contests: number;
    contests_decided: number;
    restaurants_competing: number;
    restaurants_available: number; // no-website, not yet in a contest
  };
};

// ---- Pure assembly -------------------------------------------------------------

export type CampaignRow = {
  id: string;
  /** 'restaurant_competition' (claim contest) or 'geo_services' (legacy rent model). */
  kind: string;
  city: string;
  region: string | null;
  domain: string;
  slug: string;
  domain_status: string | null;
  status: string | null;
  claimed_by_prospect_id: string | null;
};

export type ProspectRow = {
  id: string;
  business_name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  lead_tier: string;
  status: string;
  template_id: string | null;
  geo_campaign_id: string | null;
  waitlist_status: string | null;
};

export type TemplateRow = { id: string; slug: string | null; published: boolean | null; custom_domain: string | null };

export type LinkBuilders = {
  /** Tracked per-prospect funnel link (/r/<campaign>?p=<prospect>) — logs intent then claims. */
  tracked: (campaignId: string, prospectId: string) => string;
  /** Direct tokenized claim link for a built draft not (yet) in a contest. */
  claim: (templateId: string) => string;
  /** The restaurant's own site URL. */
  site: (slug: string, customDomain: string | null) => string;
};

const cityKey = (city: string | null | undefined) => (city || '').trim().toLowerCase();

/** 'boston-restaurant.com' → 'Boston' (null when the label isn't <city>-restaurant). */
export function cityFromRestaurantDomain(domain: string): string | null {
  const norm = normalizeDomain(domain);
  const label = norm.includes('.') ? norm.split('.')[0] : norm;
  const m = label.match(/^(.+)-restaurants?$/);
  if (!m) return null;
  return m[1]
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Owned-domain rows that look like restaurant location apexes (<city>-restaurant.com). */
export function isRestaurantLocationDomain(domain: string): boolean {
  return /restaurants?$/.test(domainLabelKey(domain)) && !!cityFromRestaurantDomain(domain);
}

function toAreaRestaurant(
  p: ProspectRow,
  tpl: TemplateRow | undefined,
  opts: { campaignId: string | null; winnerProspectId: string | null; links: LinkBuilders },
): AreaRestaurant {
  const siteUrl = tpl?.slug ? opts.links.site(tpl.slug, tpl.custom_domain ?? null) : null;
  // Funnel link: tracked when the restaurant is in a contest (attributes the visit),
  // direct tokenized claim otherwise (only possible once a draft exists).
  const claimUrl = opts.campaignId
    ? opts.links.tracked(opts.campaignId, p.id)
    : p.template_id
      ? opts.links.claim(p.template_id)
      : null;
  return {
    id: p.id,
    business_name: p.business_name,
    phone: p.phone,
    address: p.address,
    status: p.status,
    template_id: p.template_id,
    published: !!tpl?.published,
    site_url: siteUrl,
    claim_url: claimUrl,
    is_winner: !!opts.winnerProspectId && p.id === opts.winnerProspectId,
    waitlist_status: p.waitlist_status,
  };
}

/**
 * Join campaigns + prospects + owned domains into per-area cards:
 *   - one area per restaurant competition (live contests first),
 *   - one per owned restaurant apex with no contest yet,
 *   - one per city that has unclaimed no-website restaurants but no domain at all
 *     (domain derived, marked un-owned) — the "ready to launch" pipeline.
 */
export function assembleRestaurantDomainAreas(input: {
  campaigns: CampaignRow[];
  prospects: ProspectRow[];
  templates: TemplateRow[];
  ownedDomains: string[];
  links: LinkBuilders;
}): RestaurantDomainOverview {
  const { campaigns, prospects, links } = input;
  const tplById = new Map(input.templates.map((t) => [t.id, t]));
  const ownedNormalized = new Set(input.ownedDomains.map(normalizeDomain).filter(Boolean));
  const prospectById = new Map(prospects.map((p) => [p.id, p]));

  const live = prospects.filter((p) => p.status !== 'dismissed');
  const byCampaign = new Map<string, ProspectRow[]>();
  for (const p of live) {
    if (!p.geo_campaign_id) continue;
    if (!byCampaign.has(p.geo_campaign_id)) byCampaign.set(p.geo_campaign_id, []);
    byCampaign.get(p.geo_campaign_id)!.push(p);
  }
  // Free agents: no-website restaurants not in any contest — the pool each area draws from.
  const freeByCity = new Map<string, ProspectRow[]>();
  for (const p of live) {
    if (p.geo_campaign_id || p.lead_tier !== 'no_website') continue;
    const k = cityKey(p.city);
    if (!k) continue;
    if (!freeByCity.has(k)) freeByCity.set(k, []);
    freeByCity.get(k)!.push(p);
  }

  const areas: RestaurantDomainArea[] = [];
  const coveredCities = new Set<string>();
  const coveredDomains = new Set<string>();

  // 1) Contests — one area per restaurant competition.
  for (const c of campaigns) {
    const ck = cityKey(c.city);
    coveredCities.add(ck);
    coveredDomains.add(normalizeDomain(c.domain));
    const winnerId = c.claimed_by_prospect_id;
    const winnerName = winnerId ? (prospectById.get(winnerId)?.business_name ?? null) : null;
    const cohort = (byCampaign.get(c.id) ?? []).map((p) =>
      toAreaRestaurant(p, p.template_id ? tplById.get(p.template_id) : undefined, {
        campaignId: c.id,
        winnerProspectId: winnerId,
        links,
      }),
    );
    const candidates = (freeByCity.get(ck) ?? []).map((p) =>
      toAreaRestaurant(p, p.template_id ? tplById.get(p.template_id) : undefined, {
        campaignId: null,
        winnerProspectId: null,
        links,
      }),
    );
    areas.push({
      key: `campaign:${c.id}`,
      domain: c.domain,
      domain_owned: true, // provisioned (or attaching) via the campaign
      domain_status: c.domain_status,
      directory_url: `https://${c.domain}`,
      city: c.city,
      region: c.region,
      campaign_id: c.id,
      campaign_status: c.status,
      campaign_kind: c.kind,
      has_winner: !!winnerId,
      winner_name: winnerName,
      competitors: sortRestaurants(cohort),
      candidates: sortRestaurants(candidates),
    });
  }

  // 2) Owned restaurant apexes with no contest yet.
  for (const d of ownedNormalized) {
    if (coveredDomains.has(d) || !isRestaurantLocationDomain(d)) continue;
    const city = cityFromRestaurantDomain(d)!;
    const ck = cityKey(city);
    coveredCities.add(ck);
    const candidates = (freeByCity.get(ck) ?? []).map((p) =>
      toAreaRestaurant(p, p.template_id ? tplById.get(p.template_id) : undefined, {
        campaignId: null,
        winnerProspectId: null,
        links,
      }),
    );
    areas.push({
      key: `owned:${d}`,
      domain: d,
      domain_owned: true,
      domain_status: null,
      directory_url: null,
      city,
      region: candidates.length ? (freeByCity.get(ck)![0].region ?? null) : null,
      campaign_id: null,
      campaign_status: null,
      campaign_kind: null,
      has_winner: false,
      winner_name: null,
      competitors: [],
      candidates: sortRestaurants(candidates),
    });
  }

  // 3) Cities with unclaimed no-website restaurants and no domain yet (derived apex).
  for (const [ck, group] of freeByCity) {
    if (coveredCities.has(ck) || !group.length) continue;
    const city = group[0].city!;
    const derived = geoDomainFor(city, 'restaurant');
    const candidates = group.map((p) =>
      toAreaRestaurant(p, p.template_id ? tplById.get(p.template_id) : undefined, {
        campaignId: null,
        winnerProspectId: null,
        links,
      }),
    );
    areas.push({
      key: `city:${ck}`,
      domain: derived.domain,
      domain_owned: ownedNormalized.has(normalizeDomain(derived.domain)),
      domain_status: null,
      directory_url: null,
      city,
      region: group[0].region ?? null,
      campaign_id: null,
      campaign_status: null,
      campaign_kind: null,
      has_winner: false,
      winner_name: null,
      competitors: [],
      candidates: sortRestaurants(candidates),
    });
  }

  // Contests first (undecided before decided), then owned domains, then by pool size.
  areas.sort((a, b) => {
    const rank = (x: RestaurantDomainArea) =>
      x.campaign_id ? (x.has_winner ? 1 : 0) : x.domain_owned ? 2 : 3;
    return (
      rank(a) - rank(b) ||
      b.competitors.length + b.candidates.length - (a.competitors.length + a.candidates.length) ||
      a.city.localeCompare(b.city)
    );
  });

  const competing = areas.reduce((s, a) => s + a.competitors.length, 0);
  const available = areas.reduce((s, a) => s + a.candidates.length, 0);
  // Rent-model (geo_services) restaurant campaigns count as owned domains but NOT as
  // contests — they haven't been converted to the claim-contest mechanic yet.
  const contests = campaigns.filter((c) => c.kind === RESTAURANT_COMPETITION_KIND);
  return {
    areas,
    totals: {
      domains_owned: areas.filter((a) => a.domain_owned).length,
      contests: contests.length,
      contests_decided: contests.filter((c) => !!c.claimed_by_prospect_id).length,
      restaurants_competing: competing,
      restaurants_available: available,
    },
  };
}

/** Winner → built → alphabetical, so the actionable rows float up. */
function sortRestaurants(rows: AreaRestaurant[]): AreaRestaurant[] {
  return [...rows].sort(
    (a, b) =>
      Number(b.is_winner) - Number(a.is_winner) ||
      Number(!!b.template_id) - Number(!!a.template_id) ||
      a.business_name.localeCompare(b.business_name),
  );
}

// ---- I/O wrapper -----------------------------------------------------------------

export async function getRestaurantLocationDomains(): Promise<RestaurantDomainOverview> {
  const [{ data: campaigns }, { data: prospects }, { data: owned }] = await Promise.all([
    // Every campaign in the restaurant vertical: true claim contests AND legacy
    // rent-model (geo_services) campaigns that targeted restaurants — e.g. a
    // <city>-restaurant.com launched from the services competition cards. The
    // latter surface with a "convert to claim contest" affordance.
    supabaseAdmin
      .from('geo_industry_campaigns')
      .select('id, kind, city, region, domain, slug, domain_status, status, claimed_by_prospect_id')
      .or(`kind.eq.${RESTAURANT_COMPETITION_KIND},industry_key.eq.restaurant`)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('outreach_prospects')
      .select(
        'id, business_name, phone, address, city, region, lead_tier, status, template_id, geo_campaign_id, waitlist_status',
      )
      .eq('industry_key', 'restaurant')
      .order('created_at', { ascending: false })
      .limit(2000),
    supabaseAdmin.from('owned_domains').select('domain'),
  ]);

  const prospectRows = (prospects ?? []) as ProspectRow[];
  const templateIds = Array.from(new Set(prospectRows.map((p) => p.template_id).filter(Boolean))) as string[];
  const { data: templates } = templateIds.length
    ? await supabaseAdmin.from('templates').select('id, slug, published, custom_domain').in('id', templateIds)
    : { data: [] as TemplateRow[] };

  return assembleRestaurantDomainAreas({
    campaigns: (campaigns ?? []) as CampaignRow[],
    prospects: prospectRows,
    templates: (templates ?? []) as TemplateRow[],
    ownedDomains: ((owned ?? []) as { domain: string }[]).map((r) => r.domain),
    links: {
      tracked: (campaignId, prospectId) => trackedClaimUrl(campaignId, prospectId),
      claim: (templateId) => claimUrlFor(templateId),
      site: (slug, customDomain) => (customDomain ? `https://${customDomain}` : menuSiteUrl(slug)),
    },
  });
}

/**
 * Pull built, un-linked restaurants into an EXISTING contest (the "add to contest"
 * action on the area card). Validates the campaign is a restaurant competition and
 * only links prospects that have a built site and aren't in a contest already.
 * Returns the ids actually linked.
 */
export async function addProspectsToCompetition(campaignId: string, prospectIds: string[]): Promise<string[]> {
  const ids = Array.from(new Set(prospectIds.filter(Boolean)));
  if (!ids.length) return [];

  const { data: campaign, error } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, kind')
    .eq('id', campaignId)
    .maybeSingle();
  if (error) throw new Error(`addProspectsToCompetition failed: ${error.message}`);
  if (!campaign || campaign.kind !== RESTAURANT_COMPETITION_KIND) {
    throw new Error('Not a restaurant competition.');
  }

  const { data: rows } = await supabaseAdmin
    .from('outreach_prospects')
    .select('id, template_id, geo_campaign_id, status')
    .in('id', ids);
  const eligible = ((rows ?? []) as any[])
    .filter((p) => p.template_id && !p.geo_campaign_id && p.status !== 'dismissed')
    .map((p) => p.id as string);
  if (!eligible.length) {
    throw new Error('No eligible restaurants — each needs a built site and must not be in a contest already.');
  }

  await linkProspectsToCampaign(campaignId, eligible);
  return eligible;
}

export type ConvertResult = {
  campaignId: string;
  domain: string;
  cohortSize: number;
  /** Set when the shared pitch site couldn't be moved off the apex slug (e.g. published-slug lock). */
  warning: string | null;
};

/**
 * Convert a legacy rent-model (geo_services) restaurant campaign into a claim contest:
 * flip kind → 'restaurant_competition' and free the apex for the winner directory by
 * parking the shared pitch site at `<slug>-pitch` (the directory only renders when no
 * template occupies the apex slug — see app/sites/[slug]). Refuses when the domain is
 * already rented or claimed (money/ownership attached), or when fewer than 2 linked
 * restaurants have built sites (no cohort to race).
 */
export async function convertToRestaurantCompetition(campaignId: string): Promise<ConvertResult> {
  const { data: c, error } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, kind, industry_key, domain, slug, template_id, status, claimed_by_prospect_id, renter_email, stripe_subscription_id')
    .eq('id', campaignId)
    .maybeSingle();
  if (error) throw new Error(`convertToRestaurantCompetition failed: ${error.message}`);
  if (!c) throw new Error('Campaign not found.');
  if (c.kind === RESTAURANT_COMPETITION_KIND) throw new Error('Already a claim contest.');
  if (c.industry_key !== 'restaurant') throw new Error('Not a restaurant campaign.');
  if (c.renter_email || c.stripe_subscription_id) {
    throw new Error('This domain is rented — cancel the rental before converting it to a claim contest.');
  }
  if (c.claimed_by_prospect_id || c.status === 'claimed') {
    throw new Error('This campaign was already claimed under the rent model.');
  }

  // The cohort that will race: linked, undismissed prospects with their own built site.
  const { data: linked } = await supabaseAdmin
    .from('outreach_prospects')
    .select('id, template_id, status')
    .eq('geo_campaign_id', campaignId);
  const cohortSize = ((linked ?? []) as any[]).filter((p) => p.template_id && p.status !== 'dismissed').length;
  if (cohortSize < 2) {
    throw new Error(`A contest needs 2+ linked restaurants with built sites (found ${cohortSize}) — build their drafts first.`);
  }

  // Park the pitch site off the apex slug so the directory can front the domain.
  // Slug changes must go through the sanctioned app.set_template_slug RPC (direct
  // template UPDATEs are guard-blocked); a published pitch site may refuse the rename —
  // convert anyway and surface the warning instead of failing.
  let warning: string | null = null;
  if (c.template_id) {
    let parked = false;
    for (let i = 0; i < 3 && !parked; i++) {
      const candidate = i === 0 ? `${c.slug}-pitch` : `${c.slug}-pitch-${i + 1}`;
      const r = await supabaseAdmin.schema('app').rpc('set_template_slug', { p_id: c.template_id, p_slug: candidate });
      if (!r.error) parked = true;
      else if (!/slug.*taken|domain.*conflict|23505/i.test(`${r.error.code} ${r.error.message}`)) {
        warning = `Pitch site still occupies ${c.slug} (${r.error.message}) — unpublish or rename it so the winner directory can front the apex.`;
        break;
      }
    }
    if (!parked && !warning) {
      warning = `Pitch site still occupies ${c.slug} — rename it so the winner directory can front the apex.`;
    }
  }

  const { error: updErr } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .update({ kind: RESTAURANT_COMPETITION_KIND, template_id: null, updated_at: new Date().toISOString() })
    .eq('id', campaignId)
    .eq('kind', c.kind); // no-op if something else converted it concurrently
  if (updErr) throw new Error(`convertToRestaurantCompetition failed: ${updErr.message}`);

  return { campaignId, domain: c.domain, cohortSize, warning };
}
