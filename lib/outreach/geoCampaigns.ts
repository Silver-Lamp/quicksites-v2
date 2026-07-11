// lib/outreach/geoCampaigns.ts
//
// Location-industry domain campaigns: the "boston-towing.com" land-grab on top of the
// prospects fan-out. For a city + industry with several no-website businesses, we mint
// the exact-match domain (QuickSites-owned SEO asset) + stand up ONE claimable pitch
// site whose slug == the domain's apex label, so middleware's arbitrary-custom-domain
// rewrite serves it once the domain is attached to Vercel. Pitch to the competing
// businesses; first to claim gets the domain pointed at their branded site.
//
// Domain REGISTRATION spends money and is flag-gated (GEO_DOMAIN_REGISTER_ENABLED) in
// lib/domains/namecheap.ts#registerDomain — a campaign never buys a domain by accident.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { buildIndustryStarter } from '@/lib/builder/industryScaffold';
import { KEY_TO_LABEL, type IndustryKey } from '@/lib/industries';
import { checkDomainAvailability, registerDomain, namecheapConfigured } from '@/lib/domains/namecheap';
import { addProjectDomain } from '@/lib/domains/vercel';

// Clean single-word (or hyphenated) domain fragment per industry — the compound keys
// (salon_spa, medical_dental) get a nicer domain word than the raw key.
const INDUSTRY_DOMAIN_WORD: Partial<Record<IndustryKey, string>> = {
  salon_spa: 'salon',
  medical_dental: 'dental',
  general_contractor: 'contractor',
  auto_repair: 'auto-repair',
  real_estate: 'real-estate',
  carpet_cleaning: 'carpet-cleaning',
  window_washing: 'window-cleaning',
  pressure_washing: 'pressure-washing',
  junk_removal: 'junk-removal',
  roof_cleaning: 'roofing',
  windshield_repair: 'auto-glass',
  pest_control: 'pest-control',
};

export function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 63);
}

function industryDomainWord(key: IndustryKey): string {
  return INDUSTRY_DOMAIN_WORD[key] ?? key.replace(/_/g, '-');
}

/**
 * Derive the exact-match domain + pitch-site slug for a city + industry.
 * slug == the apex label so middleware host→/sites/<slug> rewrite serves the pitch
 * site with no extra mapping. e.g. ('Boston','towing') → { domain:'boston-towing.com',
 * slug:'boston-towing' }.
 */
export function geoDomainFor(
  city: string,
  industryKey: IndustryKey,
  tld = 'com',
): { domain: string; slug: string } {
  const slug = slugify(`${city}-${industryDomainWord(industryKey)}`);
  return { domain: `${slug}.${tld}`, slug };
}

export type GeoCampaign = {
  id: string;
  city: string;
  region: string | null;
  industry_key: IndustryKey;
  domain: string;
  slug: string;
  template_id: string | null;
  domain_status: string;
  status: string;
  claimed_by_prospect_id: string | null;
};

function uuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id_${Math.random().toString(36).slice(2)}${Date.now()}`;
}

/**
 * Build + insert the claimable pitch site for a geo campaign. The template slug is
 * FORCED to the domain's apex label so the custom domain serves it. Owner = operator,
 * claim_source='listing_import' so it rides the existing claim/QR flow.
 */
export async function buildGeoPitchSite(opts: {
  city: string;
  region?: string | null;
  industryKey: IndustryKey;
  slug: string;
  operatorId: string;
}): Promise<{ templateId: string; slug: string }> {
  const label = KEY_TO_LABEL[opts.industryKey] ?? 'Services';
  const place = opts.region ? `${opts.city}, ${opts.region}` : opts.city;
  const businessName = `${opts.city} ${label}`;

  const tpl: any = buildIndustryStarter({ businessName, industryKey: opts.industryKey });

  // Localize the hero to the city so the pitch reads as a real local site.
  const hero = tpl.data?.pages?.[0]?.blocks?.[0];
  if (hero?.content) {
    hero.content.headline = businessName;
    hero.content.subheadline = `Serving ${place} and nearby. Fast, local, and reliable — get a free quote today.`;
  }
  if (tpl.data?.meta) {
    tpl.data.meta.geo_campaign = true;
    tpl.data.meta.geo_city = opts.city;
    tpl.data.meta.geo_industry = opts.industryKey;
  }

  const row: any = {
    id: uuid(),
    template_name: businessName,
    slug: opts.slug, // MUST equal the domain apex label
    data: tpl.data,
    color_mode: tpl.color_mode,
    header_block: tpl.header_block,
    footer_block: tpl.footer_block,
    is_site: false,
    industry: opts.industryKey,
    business_name: businessName,
    owner_id: opts.operatorId,
    claim_source: 'listing_import',
  };

  // The slug MUST match the apex label; if it collides, the campaign can't use this
  // domain — surface that rather than silently randomizing the slug.
  const { data, error } = await supabaseAdmin.from('templates').insert(row).select('id, slug').single();
  if (error) {
    if (`${error.code}` === '23505') {
      throw new Error(`slug "${opts.slug}" is already taken — pick a different domain.`);
    }
    throw new Error(error.message || 'Could not create the pitch site.');
  }
  return { templateId: data.id, slug: data.slug };
}

/**
 * Provision the domain: check availability, optionally register (flag-gated), attach to
 * Vercel. Never throws — returns a status the campaign row records, so a provisioning
 * hiccup doesn't lose the pitch site. Returns one of the domain_status values.
 */
export async function provisionGeoDomain(domain: string): Promise<{ status: string; detail?: string }> {
  if (!namecheapConfigured()) {
    // Can't check/register — leave as planned so an operator can do it manually.
    return { status: 'planned', detail: 'namecheap_not_configured' };
  }
  let available: boolean | null;
  try {
    available = await checkDomainAvailability(domain);
  } catch (e: any) {
    return { status: 'failed', detail: e?.message || 'availability_check_failed' };
  }
  if (available === false) return { status: 'unavailable' };

  // Register (spends money — off unless GEO_DOMAIN_REGISTER_ENABLED).
  let registered = false;
  try {
    const r = await registerDomain(domain);
    registered = r.registered;
    if (!registered && r.reason === 'registration_disabled') {
      return { status: 'available', detail: 'registration_disabled' };
    }
    if (!registered) return { status: 'available', detail: r.reason };
  } catch (e: any) {
    return { status: 'failed', detail: e?.message || 'registration_failed' };
  }

  // Attach apex to the Vercel project so middleware can serve it.
  try {
    await addProjectDomain(domain);
    await addProjectDomain(`www.${domain}`);
  } catch (e: any) {
    return { status: 'registered', detail: `attach_failed: ${e?.message || ''}` };
  }
  return { status: 'attached' };
}

export async function createGeoCampaign(row: {
  city: string;
  region?: string | null;
  country?: string | null;
  centerLat?: number | null;
  centerLon?: number | null;
  industryKey: IndustryKey;
  domain: string;
  slug: string;
  templateId: string;
  domainStatus: string;
  createdBy: string;
}): Promise<GeoCampaign> {
  const { data, error } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .insert({
      city: row.city,
      region: row.region ?? null,
      country: row.country ?? null,
      center_lat: row.centerLat ?? null,
      center_lon: row.centerLon ?? null,
      industry_key: row.industryKey,
      domain: row.domain,
      slug: row.slug,
      template_id: row.templateId,
      domain_status: row.domainStatus,
      status: 'draft',
      created_by: row.createdBy,
    })
    .select('id, city, region, industry_key, domain, slug, template_id, domain_status, status, claimed_by_prospect_id')
    .single();
  if (error) throw new Error(`createGeoCampaign failed: ${error.message}`);
  return data as GeoCampaign;
}

/** Tag the pitched businesses with the campaign (competition set). */
export async function linkProspectsToCampaign(campaignId: string, prospectIds: string[]): Promise<void> {
  if (!prospectIds.length) return;
  const { error } = await supabaseAdmin
    .from('outreach_prospects')
    .update({ geo_campaign_id: campaignId, updated_at: new Date().toISOString() })
    .in('id', prospectIds);
  if (error) throw new Error(`linkProspectsToCampaign failed: ${error.message}`);
}

export async function getGeoCampaign(id: string): Promise<GeoCampaign | null> {
  const { data, error } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, city, region, industry_key, domain, slug, template_id, domain_status, status, claimed_by_prospect_id')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`getGeoCampaign failed: ${error.message}`);
  return (data as GeoCampaign) ?? null;
}

export async function listGeoCampaigns(limit = 200): Promise<GeoCampaign[]> {
  const { data, error } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, city, region, industry_key, domain, slug, template_id, domain_status, status, claimed_by_prospect_id')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listGeoCampaigns failed: ${error.message}`);
  return (data ?? []) as GeoCampaign[];
}
