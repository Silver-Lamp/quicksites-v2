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
  /**
   * Google star rating and its review count, as returned by the SEARCH call.
   *
   * ⚠️ These ride along free. `PLACES_FIELD_MASK` already requests `places.rating` +
   * `places.userRatingCount` — deliberately, at a pricier SKU — so the search response has
   * carried them all along while `runSweep` dropped them on the floor and the columns sat unused.
   * The only thing that ever filled them was `backfillPlaceSignals`, a SECOND, separately-billed
   * Place Details call per business, flag-gated off by default. We were paying the premium tier
   * for these two numbers, discarding them, then paying again to fetch them back.
   */
  rating?: number | null;
  reviewCount?: number | null;
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
    // ⚠️ `?? null` and never 0 — mapPlace already distinguishes "unrated" from "rated 0.0", and
    // collapsing them here would rank an unmeasured business as the worst one in the market.
    rating: p.rating ?? null,
    review_count: p.reviewCount ?? null,
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

/**
 * Stamp every place a sweep observed as seen now — inserted or not.
 *
 * ⚠️ This is the only thing a re-sweep writes to an already-parked row, and it exists because
 * `created_at` cannot answer "is this business still there". With `ignoreDuplicates: true` a row
 * is stamped once at first sight and never again, so re-observing 17 Renton tow companies in
 * September left them all reading 2026-07-14 and the pool stayed permanently `stale` — advising
 * a re-sweep of the city that had just been swept.
 *
 * Deliberately narrow: it touches `last_seen_at` and nothing else, so a worked lead's status,
 * owner and claim history are untouched.
 */
export async function markProspectsSeen(placeIds: string[]): Promise<number> {
  const ids = [...new Set(placeIds.filter(Boolean))];
  if (!ids.length) return 0;
  const { data, error } = await supabaseAdmin
    .from('outreach_prospects')
    .update({ last_seen_at: new Date().toISOString() })
    .in('place_id', ids)
    .select('id');
  if (error) return 0;
  return data?.length ?? 0;
}

/**
 * Fill `rating` / `review_count` on rows a re-sweep just skipped.
 *
 * ⚠️ `upsertProspects` sets `ignoreDuplicates: true` so a re-sweep never clobbers a worked lead —
 * correct for `status`, `template_id`, `claimed_at`, and the reason a business swept twice keeps
 * its history. The side effect is that a row inserted before ratings were stored can never
 * acquire one, no matter how often the city is swept: the second sweep fetches the rating, pays
 * for it, and discards it at the door.
 *
 * So this fills ONLY where the column is currently null. It is not a refresh — an existing rating
 * is left alone, because the alternative is a search-tier number silently overwriting a
 * Place-Details one, and gap-filling is the whole need. No extra API call: the values are already
 * in the sweep response.
 */
export async function fillMissingPlaceSignals(rows: ProspectInput[]): Promise<number> {
  const withSignals = rows.filter((r) => r.rating != null || r.reviewCount != null);
  if (!withSignals.length) return 0;
  let filled = 0;
  for (const r of withSignals) {
    const { data } = await supabaseAdmin
      .from('outreach_prospects')
      .update({ rating: r.rating ?? null, review_count: r.reviewCount ?? null })
      .eq('place_id', r.placeId)
      .is('rating', null)
      .select('id');
    filled += data?.length ?? 0;
  }
  return filled;
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

export type ListProspectsOptions = {
  /**
   * Skip prospects already contacted on this channel, so consecutive sends WORK THROUGH the list
   * instead of re-picking its head.
   *
   * ⚠️ Why this exists: the senders take `.slice(0, MAX_PIECES)` of this result, ordered newest
   * first. With no filter, a second send re-selects the SAME 25 prospects — Lob's idempotency key
   * quietly prevents a duplicate charge, so nothing errors, nothing is billed twice, and prospect
   * 26 simply never receives a card. A campaign with 60 targets would mail 25 of them forever and
   * every dashboard would call it a success.
   */
  unmailedOn?: 'postcard' | 'sms';
};

export async function listProspectsByCampaign(
  campaignId: string,
  opts: ListProspectsOptions = {},
): Promise<Prospect[]> {
  let q = supabaseAdmin
    .from('outreach_prospects')
    .select(
      'id, created_at, place_id, business_name, phone, address, address_lat, address_lon, city, region, industry_key, categories, website, freshness_score, freshness_signals, lead_tier, status, template_id, geo_campaign_id, waitlist_status, sweep_id, rating, review_count',
    )
    .eq('geo_campaign_id', campaignId);

  if (opts.unmailedOn === 'postcard') q = q.is('postcard_sent_at', null);
  if (opts.unmailedOn === 'sms') q = q.is('sms_sent_at', null);

  // Oldest first when working through a list: a prospect that has waited longest goes next.
  // (Unfiltered callers keep the original newest-first order so previews are unchanged.)
  const { data, error } = await q.order('created_at', { ascending: Boolean(opts.unmailedOn) });
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
