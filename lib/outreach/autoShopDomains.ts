// lib/outreach/autoShopDomains.ts
//
// Data layer for the auto-shop domain-competition cockpit (/admin/auto-shop-domains).
// A focused mirror of restaurantDomains.ts: lists the <city>-auto-repair.com competitions
// (each with its cohort + winner + directory link) and the candidate cities (no-website
// auto shops not yet in a competition) so an operator can launch new ones. Pure assembly.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { AUTO_SHOP_COMPETITION_KIND } from '@/lib/outreach/competitionKinds';

/** Auto-service verticals that belong in an auto-shop competition (matches the poster set). */
export const AUTO_SHOP_INDUSTRIES = ['auto_repair', 'windshield_repair'];

export type AutoShopCompetitor = {
  prospectId: string;
  businessName: string;
  templateId: string | null;
  slug: string | null;
  published: boolean;
  isWinner: boolean;
};

export type AutoShopArea = {
  campaignId: string;
  domain: string;
  slug: string;
  city: string;
  region: string | null;
  status: string;
  domainStatus: string | null;
  directoryUrl: string;
  hasWinner: boolean;
  competitors: AutoShopCompetitor[];
};

export type AutoShopCandidateCity = {
  city: string;
  region: string | null;
  shops: { prospectId: string; businessName: string; built: boolean }[];
  builtCount: number;
};

export type AutoShopCockpit = {
  areas: AutoShopArea[];
  candidateCities: AutoShopCandidateCity[];
  kpis: { competitions: number; claimed: number; candidateCities: number };
};

export async function getAutoShopCockpit(): Promise<AutoShopCockpit> {
  // 1. Competitions
  const { data: campaigns } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, domain, slug, city, region, status, domain_status, claimed_by_prospect_id')
    .eq('kind', AUTO_SHOP_COMPETITION_KIND)
    .order('created_at', { ascending: false });
  const comps = campaigns ?? [];

  // 2. All auto-service prospects (linked + free candidates)
  const { data: prospects } = await supabaseAdmin
    .from('outreach_prospects')
    .select('id, business_name, city, region, template_id, geo_campaign_id, lead_tier, industry_key')
    .in('industry_key', AUTO_SHOP_INDUSTRIES);
  const all = prospects ?? [];

  // 3. Templates for linked prospects (slug/published)
  const linkedTemplateIds = all.filter((p: any) => p.geo_campaign_id && p.template_id).map((p: any) => p.template_id);
  const tplById = new Map<string, any>();
  if (linkedTemplateIds.length) {
    const { data: templates } = await supabaseAdmin
      .from('templates')
      .select('id, slug, business_name, published')
      .in('id', linkedTemplateIds);
    for (const t of templates ?? []) tplById.set(t.id, t);
  }

  const byCampaign = new Map<string, any[]>();
  for (const p of all) {
    if (p.geo_campaign_id) {
      if (!byCampaign.has(p.geo_campaign_id)) byCampaign.set(p.geo_campaign_id, []);
      byCampaign.get(p.geo_campaign_id)!.push(p);
    }
  }

  const areas: AutoShopArea[] = comps.map((c: any) => {
    const cohort = byCampaign.get(c.id) ?? [];
    const competitors: AutoShopCompetitor[] = cohort.map((p: any) => {
      const t = p.template_id ? tplById.get(p.template_id) : null;
      return {
        prospectId: p.id,
        businessName: t?.business_name || p.business_name,
        templateId: p.template_id ?? null,
        slug: t?.slug ?? null,
        published: !!t?.published,
        isWinner: !!c.claimed_by_prospect_id && p.id === c.claimed_by_prospect_id,
      };
    });
    competitors.sort((a, b) => Number(b.isWinner) - Number(a.isWinner) || a.businessName.localeCompare(b.businessName));
    return {
      campaignId: c.id,
      domain: c.domain,
      slug: c.slug,
      city: c.city,
      region: c.region,
      status: c.status,
      domainStatus: c.domain_status,
      directoryUrl: `https://${c.domain}`,
      hasWinner: !!c.claimed_by_prospect_id,
      competitors,
    };
  });

  // 4. Candidate cities: no-website auto shops not yet in any competition, grouped by city.
  const freeByCity = new Map<string, any[]>();
  for (const p of all) {
    if (p.geo_campaign_id || p.lead_tier !== 'no_website') continue;
    const city = (p.city || '').trim();
    if (!city) continue;
    const key = city.toLowerCase();
    if (!freeByCity.has(key)) freeByCity.set(key, []);
    freeByCity.get(key)!.push(p);
  }
  const candidateCities: AutoShopCandidateCity[] = Array.from(freeByCity.values())
    .filter((g) => g.length >= 2)
    .map((g) => {
      const shops = g.map((p: any) => ({ prospectId: p.id, businessName: p.business_name, built: !!p.template_id }));
      return {
        city: g[0].city,
        region: g[0].region ?? null,
        shops: shops.sort((a, b) => Number(b.built) - Number(a.built) || a.businessName.localeCompare(b.businessName)),
        builtCount: shops.filter((s) => s.built).length,
      };
    })
    .sort((a, b) => b.builtCount - a.builtCount || b.shops.length - a.shops.length);

  return {
    areas,
    candidateCities,
    kpis: {
      competitions: areas.length,
      claimed: areas.filter((a) => a.hasWinner).length,
      candidateCities: candidateCities.length,
    },
  };
}
