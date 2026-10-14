// lib/rep/islandNoSite.ts
//
// The live reads a rep's /for-<name> page makes about a city: the businesses Google lists with no
// website (from the parked sweep rows) and the <city>-<trade>.com campaign sites. Lifted out of
// app/for-abdou/page.tsx when a second Vashon rep (Craig, 2026-10-14) needed the same lists —
// a hand-typed table is a count that rots, so both pages read these.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { KEY_TO_LABEL } from '@/lib/industries';

export type NoSiteRow = {
  id: string;
  business_name: string | null;
  phone: string | null;
  address: string | null;
  industry_key: string | null;
  rating: number | null;
  review_count: number | null;
  last_seen_at: string | null;
  template_id: string | null;
  templates: { slug: string | null } | null;
};

export function tradeLabel(key: string | null): string {
  if (!key) return 'Other';
  return (KEY_TO_LABEL as Record<string, string>)[key] ?? key.replace(/_/g, ' ');
}

/** "17601 Vashon Hwy SW, Vashon, WA 98070, USA" → "17601 Vashon Hwy SW" */
export function streetOf(address: string | null, city: string): string {
  const first = (address ?? '').split(',')[0]?.trim() ?? '';
  return new RegExp(`${city}, [a-z]{2}`, 'i').test(first) || !first ? '' : first;
}

/**
 * Businesses Google lists with no website, from the parked sweep rows.
 * ⚠️ Only rows with a phone: a listing with no phone and no rating is often not a business at all.
 * ⚠️ A SECOND QUERY, NOT AN EMBED: `templates:template_id ( slug )` is not a declared foreign key,
 * so PostgREST answers the whole select with an error and the page renders an empty table.
 */
export async function loadCityNoSite(city: string, region: string): Promise<{ rows: NoSiteRow[]; sweptOn: string | null }> {
  const { data } = await supabaseAdmin
    .from('outreach_prospects')
    .select('id, business_name, phone, address, industry_key, rating, review_count, last_seen_at, template_id')
    .eq('city', city)
    .eq('region', region)
    .not('phone', 'is', null)
    .or('website.is.null,website.eq.,website.eq.no site')
    .limit(200);
  const base = ((data ?? []) as unknown as Omit<NoSiteRow, 'templates'>[]).filter((r) => (r.business_name ?? '').trim());
  const templateIds = base.map((r) => r.template_id).filter((id): id is string => !!id);
  const slugById = new Map<string, string>();
  if (templateIds.length) {
    const { data: tpls } = await supabaseAdmin.from('templates').select('id, slug').in('id', templateIds);
    for (const t of (tpls ?? []) as Array<{ id: string; slug: string | null }>) if (t.slug) slugById.set(t.id, t.slug);
  }
  const rows: NoSiteRow[] = base
    .map((r) => ({ ...r, templates: r.template_id && slugById.has(r.template_id) ? { slug: slugById.get(r.template_id)! } : null }))
    .sort((a, b) => tradeLabel(a.industry_key).localeCompare(tradeLabel(b.industry_key)) || (b.review_count ?? 0) - (a.review_count ?? 0));
  const sweptOn = rows.reduce<string | null>((m, r) => (r.last_seen_at && (!m || r.last_seen_at > m) ? r.last_seen_at : m), null);
  return { rows, sweptOn };
}

/**
 * The <prefix>-<trade>.com campaign sites, counted live. `attached` means attached to Vercel, not
 * owned (CLAUDE.md §8), but the nightly backfill writes `unregistered` for any that is not, so
 * registered/attached is the honest count. `payment_count > 0` is the only proof of rent.
 */
export async function loadCitySites(domainPrefix: string): Promise<{ built: number; forwarding: number; rented: number }> {
  const { data } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('domain, domain_status, forward_to, payment_count')
    .ilike('domain', `${domainPrefix}-%`)
    .in('domain_status', ['registered', 'attached']);
  const rows = (data ?? []) as Array<{ domain: string; forward_to: string | null; payment_count: number | null }>;
  return { built: rows.length, forwarding: rows.filter((r) => !!r.forward_to).length, rented: rows.filter((r) => (r.payment_count ?? 0) > 0).length };
}
