// lib/prospects/noOrderingList.ts
//
// The admin view of the "site, but no online ordering" segment: every swept restaurant in a
// city that has a website, grouped by what its own site says about ordering
// (lib/prospects/orderingSegments.ts), plus the list of cities that have restaurant rows so an
// operator can pick one without remembering what was swept.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { groupRestaurantsByOrdering, looksLikeFoodBusiness, type RestaurantGroups, type RestaurantRow } from '@/lib/prospects/orderingSegments';

export type AdminRestaurantRow = RestaurantRow & {
  address: string | null;
  status: string | null;
  categories: string[] | null;
  slug: string | null;
  ordering_evidence: string[] | null;
  /** Response tracking — the same fields the claim-card funnel reads. */
  postcard_sent_at: string | null;
  claim_link_visits: number | null;
  claim_link_visited_at: string | null;
  claimed_at: string | null;
  /** The latest real Evolve card mailed to this prospect, if any. */
  card: { created_at: string; status: string; expected_delivery_date: string | null; delivered_at: string | null; returned_at: string | null; scans: number } | null;
};

export type RestaurantCity = { city: string; region: string | null; restaurants: number; checked: number; noOrdering: number };

export async function listRestaurantsByOrdering(input: { city: string; region?: string | null }): Promise<{
  groups: RestaurantGroups<AdminRestaurantRow>;
  total: number;
  checkedOn: string | null;
}> {
  let q = supabaseAdmin
    .from('outreach_prospects')
    .select('id, business_name, phone, address, website, rating, review_count, ordering_platform, ordering_checked_at, ordering_evidence, template_id, status, categories, postcard_sent_at, claim_link_visits, claim_link_visited_at, claimed_at')
    .eq('industry_key', 'restaurant')
    .not('website', 'is', null)
    .neq('website', '')
    .ilike('city', input.city)
    .limit(500);
  if (input.region) q = q.ilike('region', input.region);
  const { data, error } = await q;
  if (error) throw new Error(`listRestaurantsByOrdering: ${error.message}`);
  const base = ((data ?? []) as unknown as Omit<AdminRestaurantRow, 'slug' | 'card'>[]).filter((r) => (r.business_name ?? '').trim() && looksLikeFoodBusiness(r.categories));
  const templateIds = base.map((r) => r.template_id).filter((id): id is string => !!id);
  const slugById = new Map<string, string>();
  if (templateIds.length) {
    const { data: tpls } = await supabaseAdmin.from('templates').select('id, slug').in('id', templateIds);
    for (const t of (tpls ?? []) as Array<{ id: string; slug: string | null }>) if (t.slug) slugById.set(t.id, t.slug);
  }
  // The latest real Evolve card per prospect — so a row says "mailed Oct 10 · in transit · 0 scans",
  // the same facts the ops funnel aggregates.
  const cardById = new Map<string, AdminRestaurantRow['card']>();
  const prospectIds = base.map((r) => r.id);
  if (prospectIds.length) {
    const { data: cards } = await supabaseAdmin
      .from('postcard_mailings')
      .select('prospect_id, created_at, status, expected_delivery_date, delivered_at, returned_at, scans')
      .eq('kind', 'evolve')
      .neq('status', 'test')
      .in('prospect_id', prospectIds)
      .order('created_at', { ascending: false });
    for (const c of (cards ?? []) as Array<{ prospect_id: string; created_at: string; status: string; expected_delivery_date: string | null; delivered_at: string | null; returned_at: string | null; scans: number }>) {
      if (!cardById.has(c.prospect_id)) cardById.set(c.prospect_id, { created_at: c.created_at, status: c.status, expected_delivery_date: c.expected_delivery_date, delivered_at: c.delivered_at, returned_at: c.returned_at, scans: c.scans ?? 0 });
    }
  }
  const rows: AdminRestaurantRow[] = base.map((r) => ({ ...r, slug: r.template_id ? slugById.get(r.template_id) ?? null : null, card: cardById.get(r.id) ?? null }));
  const checkedOn = rows.reduce<string | null>((m, r) => (r.ordering_checked_at && (!m || r.ordering_checked_at > m) ? r.ordering_checked_at : m), null);
  return { groups: groupRestaurantsByOrdering(rows), total: rows.length, checkedOn };
}

/** Cities with swept restaurants that have a website, most rows first. */
export async function restaurantCities(): Promise<RestaurantCity[]> {
  const { data, error } = await supabaseAdmin
    .from('outreach_prospects')
    .select('city, region, ordering_platform, ordering_checked_at, categories')
    .eq('industry_key', 'restaurant')
    .not('website', 'is', null)
    .neq('website', '')
    .not('city', 'is', null)
    .limit(5000);
  if (error) throw new Error(`restaurantCities: ${error.message}`);
  const acc = new Map<string, RestaurantCity>();
  for (const r of (data ?? []) as Array<{ city: string; region: string | null; ordering_platform: string | null; ordering_checked_at: string | null; categories: string[] | null }>) {
    if (!looksLikeFoodBusiness(r.categories)) continue;
    const key = `${r.city}|${r.region ?? ''}`;
    const c = acc.get(key) ?? { city: r.city, region: r.region, restaurants: 0, checked: 0, noOrdering: 0 };
    c.restaurants += 1;
    if (r.ordering_checked_at) c.checked += 1;
    if (r.ordering_platform === 'none') c.noOrdering += 1;
    acc.set(key, c);
  }
  return Array.from(acc.values()).sort((a, b) => b.restaurants - a.restaurants);
}
