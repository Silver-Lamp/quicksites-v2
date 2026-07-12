// lib/outreach/prospects.ts
//
// Data access + classification for the "businesses near me" lead-gen fan-out.
// A prospect is a business discovered by a geographic Google Places sweep, parked
// here (cheaply, no AI) until the operator chooses to build a draft site for it.
//
// Storage: public.outreach_prospects (service-role only, RLS-denied to anon/auth).
// We use the untyped service-role client (supabaseAdmin) since this table isn't in
// types/supabase.ts yet — same convention as the other CRM/settings tables.

import { supabaseAdmin } from '@/lib/supabase/admin';

export type LeadTier = 'no_website' | 'dated' | 'has_site';
export type ProspectStatus = 'discovered' | 'draft_built' | 'claimed' | 'dismissed';

export type ProspectInput = {
  placeId: string;
  businessName: string;
  phone?: string | null;
  address?: string | null;
  lat?: number | null;
  lon?: number | null;
  city?: string | null;
  region?: string | null;
  industryKey?: string | null;
  categories?: string[];
  website?: string | null;
  freshnessScore?: number | null;
  freshnessSignals?: string[];
  leadTier: LeadTier;
  sweepId?: string | null;
  discoveredBy?: string | null;
  source?: string;
};

export type Prospect = {
  id: string;
  created_at: string;
  place_id: string;
  business_name: string;
  phone: string | null;
  address: string | null;
  address_lat: number | null;
  address_lon: number | null;
  city: string | null;
  region: string | null;
  industry_key: string | null;
  categories: string[];
  website: string | null;
  freshness_score: number | null;
  freshness_signals: string[];
  lead_tier: LeadTier;
  status: ProspectStatus;
  template_id: string | null;
  geo_campaign_id: string | null;
  waitlist_status: string | null;
  sweep_id: string | null;
  // Busyness proxies from Place Details (paid SKU, synced weekly) — null until synced.
  rating: number | null;
  review_count: number | null;
};

/**
 * Classify a business into a lead tier from its website + freshness score.
 * - no website          → 'no_website' (highest-intent lead)
 * - website + low score  → 'dated' (needs a rebuild)
 * - website + ok score   → 'has_site' (skip / park)
 * A null score with a website means we couldn't assess it → treat as has_site
 * (don't manufacture a lead from an unreachable/unscored site).
 */
export function classifyLeadTier(
  website: string | null | undefined,
  freshnessScore: number | null | undefined,
  datedThreshold = 55,
): LeadTier {
  if (!website) return 'no_website';
  if (typeof freshnessScore === 'number' && freshnessScore < datedThreshold) return 'dated';
  return 'has_site';
}

function toRow(p: ProspectInput) {
  return {
    place_id: p.placeId,
    business_name: p.businessName,
    phone: p.phone ?? null,
    address: p.address ?? null,
    address_lat: p.lat ?? null,
    address_lon: p.lon ?? null,
    city: p.city ?? null,
    region: p.region ?? null,
    industry_key: p.industryKey ?? null,
    categories: p.categories ?? [],
    website: p.website ?? null,
    freshness_score: p.freshnessScore ?? null,
    freshness_signals: p.freshnessSignals ?? [],
    lead_tier: p.leadTier,
    sweep_id: p.sweepId ?? null,
    discovered_by: p.discoveredBy ?? null,
    source: p.source ?? 'google_places',
  };
}

/**
 * Insert discovered prospects, ignoring any whose place_id already exists (on-conflict
 * do-nothing) so re-sweeping an area never clobbers a prospect the operator has already
 * worked (built/claimed/dismissed). Returns the count actually inserted.
 */
export async function upsertProspects(rows: ProspectInput[]): Promise<number> {
  if (!rows.length) return 0;
  const { data, error } = await supabaseAdmin
    .from('outreach_prospects')
    .upsert(rows.map(toRow), { onConflict: 'place_id', ignoreDuplicates: true })
    .select('id');
  if (error) throw new Error(`upsertProspects failed: ${error.message}`);
  return data?.length ?? 0;
}

export type ListProspectsFilter = {
  status?: ProspectStatus;
  leadTier?: LeadTier;
  sweepId?: string;
  limit?: number;
};

export async function listProspects(filter: ListProspectsFilter = {}): Promise<Prospect[]> {
  let q = supabaseAdmin
    .from('outreach_prospects')
    .select(
      'id, created_at, place_id, business_name, phone, address, address_lat, address_lon, city, region, industry_key, categories, website, freshness_score, freshness_signals, lead_tier, status, template_id, geo_campaign_id, waitlist_status, sweep_id, rating, review_count',
    )
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 300);
  if (filter.status) q = q.eq('status', filter.status);
  if (filter.leadTier) q = q.eq('lead_tier', filter.leadTier);
  if (filter.sweepId) q = q.eq('sweep_id', filter.sweepId);
  const { data, error } = await q;
  if (error) throw new Error(`listProspects failed: ${error.message}`);
  return (data ?? []) as Prospect[];
}

export async function listProspectsByCampaign(campaignId: string): Promise<Prospect[]> {
  const { data, error } = await supabaseAdmin
    .from('outreach_prospects')
    .select(
      'id, created_at, place_id, business_name, phone, address, address_lat, address_lon, city, region, industry_key, categories, website, freshness_score, freshness_signals, lead_tier, status, template_id, geo_campaign_id, waitlist_status, sweep_id, rating, review_count',
    )
    .eq('geo_campaign_id', campaignId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listProspectsByCampaign failed: ${error.message}`);
  return (data ?? []) as Prospect[];
}

export async function markOutreachSent(
  ids: string[],
  channel: 'postcard' | 'sms',
): Promise<void> {
  if (!ids.length) return;
  const col = channel === 'postcard' ? 'postcard_sent_at' : 'sms_sent_at';
  const { error } = await supabaseAdmin
    .from('outreach_prospects')
    .update({ [col]: new Date().toISOString(), updated_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw new Error(`markOutreachSent failed: ${error.message}`);
}

export async function getProspect(id: string): Promise<Prospect | null> {
  const { data, error } = await supabaseAdmin
    .from('outreach_prospects')
    .select(
      'id, created_at, place_id, business_name, phone, address, address_lat, address_lon, city, region, industry_key, categories, website, freshness_score, freshness_signals, lead_tier, status, template_id, geo_campaign_id, waitlist_status, sweep_id, rating, review_count',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`getProspect failed: ${error.message}`);
  return (data as Prospect) ?? null;
}

export async function markProspectBuilt(id: string, templateId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('outreach_prospects')
    .update({ status: 'draft_built', template_id: templateId, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`markProspectBuilt failed: ${error.message}`);
}

export async function dismissProspect(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('outreach_prospects')
    .update({ status: 'dismissed', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`dismissProspect failed: ${error.message}`);
}

/** Mark a competing business out of the running ('passed'), or restore it (null). */
export async function setWaitlistStatus(id: string, status: 'passed' | null): Promise<void> {
  const { error } = await supabaseAdmin
    .from('outreach_prospects')
    .update({ waitlist_status: status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`setWaitlistStatus failed: ${error.message}`);
}
