// lib/outreach/autoShopCompetitionDirectory.ts
//
// The public directory that fronts an auto-shop domain-competition apex
// (<city>-auto-repair.com). The apex resolves via middleware → /sites/<slug>; when no
// template occupies that slug, the sites page falls back to this directory. Lists the
// cohort shops (each linking to its own QuickSites site), WINNER featured first as "the
// shop that shows you the work" — the SecondSet transparency wedge. Pure data assembly.
// Mirrors lib/outreach/restaurantCompetitionDirectory.ts.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { AUTO_SHOP_COMPETITION_KIND } from '@/lib/outreach/competitionKinds';

export type AutoShopDirectoryEntry = {
  templateId: string;
  slug: string;
  businessName: string;
  url: string;
  heroUrl: string | null;
  isWinner: boolean;
  published: boolean;
};

/**
 * The directory's tracking line. ⚠️ A directory is not a business, so the line is shown ONLY with
 * the name of the real shop that answers it — never as "our number". Null until the campaign has
 * both a tracking number and a named forward-to (2026-10-16, paterson-auto-repair.com).
 */
export type AutoShopCallLine = { number: string; display: string; answeredBy: string };

export type AutoShopDirectory = {
  campaignId: string;
  city: string;
  region: string | null;
  domain: string;
  hasWinner: boolean;
  callLine: AutoShopCallLine | null;
  entries: AutoShopDirectoryEntry[];
};

export function callLineFor(c: { tracking_number?: string | null; forward_to?: string | null; forward_to_name?: string | null }): AutoShopCallLine | null {
  const number = (c.tracking_number ?? '').trim();
  const name = (c.forward_to_name ?? '').trim();
  if (!number || !(c.forward_to ?? '').trim() || !name) return null;
  const d = number.replace(/\D/g, '').slice(-10);
  const display = d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : number;
  return { number: number.startsWith('+') ? number : `+${number.replace(/\D/g, '')}`, display, answeredBy: name };
}

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

/** Public URL of a shop's own QuickSites site (custom domain, else the platform subdomain). */
function shopSiteUrl(slug: string, customDomain?: string | null): string {
  if (customDomain) return `https://${customDomain}`;
  return `https://${slug}.quicksites.ai`;
}

export async function loadAutoShopDirectoryBySlug(slug: string): Promise<AutoShopDirectory | null> {
  const clean = (slug || '').trim().toLowerCase();
  if (!clean) return null;
  const { data: campaign } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, city, region, domain, claimed_by_prospect_id, tracking_number, forward_to, forward_to_name')
    .eq('kind', AUTO_SHOP_COMPETITION_KIND)
    .eq('slug', clean)
    .maybeSingle();
  if (!campaign) return null;
  return assembleDirectory(campaign);
}

export async function loadAutoShopDirectoryByCampaignId(campaignId: string): Promise<AutoShopDirectory | null> {
  const clean = (campaignId || '').trim();
  if (!clean) return null;
  const { data: campaign } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, city, region, domain, claimed_by_prospect_id, tracking_number, forward_to, forward_to_name')
    .eq('kind', AUTO_SHOP_COMPETITION_KIND)
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
  tracking_number?: string | null;
  forward_to?: string | null;
  forward_to_name?: string | null;
}): Promise<AutoShopDirectory> {
  const base: Omit<AutoShopDirectory, 'entries'> = {
    campaignId: campaign.id,
    city: campaign.city,
    region: campaign.region,
    domain: campaign.domain,
    hasWinner: !!campaign.claimed_by_prospect_id,
    callLine: callLineFor(campaign),
  };

  const { data: prospects } = await supabaseAdmin
    .from('outreach_prospects')
    .select('id, template_id, business_name')
    .eq('geo_campaign_id', campaign.id)
    .not('template_id', 'is', null);
  const cohort = prospects ?? [];
  if (!cohort.length) return { ...base, entries: [] };

  const { data: templates } = await supabaseAdmin
    .from('templates')
    .select('id, slug, business_name, published, custom_domain, data')
    .in('id', cohort.map((p: any) => p.template_id));
  const tplById = new Map((templates ?? []).map((t: any) => [t.id, t]));

  const winnerProspectId = campaign.claimed_by_prospect_id;
  const entries: AutoShopDirectoryEntry[] = cohort
    .map((p: any) => {
      const t: any = tplById.get(p.template_id) ?? {};
      const tplSlug: string = t.slug ?? '';
      return {
        templateId: p.template_id,
        slug: tplSlug,
        businessName: t.business_name || p.business_name || tplSlug,
        url: shopSiteUrl(tplSlug, t.custom_domain),
        heroUrl: heroFromData(t.data),
        isWinner: !!winnerProspectId && p.id === winnerProspectId,
        published: !!t.published,
      };
    })
    .filter((e) => e.slug);

  entries.sort(
    (a, b) =>
      Number(b.isWinner) - Number(a.isWinner) ||
      Number(b.published) - Number(a.published) ||
      a.businessName.localeCompare(b.businessName),
  );

  return { ...base, entries };
}
