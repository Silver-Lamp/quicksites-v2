// lib/rep/repRestaurants.ts
//
// The restaurants of a city for a rep's page or the sales brief: swept rows with a website,
// grouped by what their own site says about online ordering (lib/prospects/orderingSegments.ts),
// shaped for components/for-rep/restaurant-table.tsx. Generalised from /for-abdou's loader so
// every /for-<name> page and the "sweep where you are" widget read the same thing.
//
// ⚠️ Only what Google and their own site show — name, phone, host, platform, rating. The sweep's
// `industry_key` is stamped by the QUERY that found the row, so Google's own categories decide
// what is food (looksLikeFoodBusiness). A rep's code, when given, puts their ref on every link.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { groupRestaurantsByOrdering, segmentLabel, looksLikeFoodBusiness, type RestaurantRow } from '@/lib/prospects/orderingSegments';
import { repBuildLinks } from '@/lib/rep/repBuild';
import type { RestaurantTableRow } from '@/components/for-rep/restaurant-table';
import { loadOutreachMarks, postcardStatusLine } from '@/lib/outreach/prospectOutreach';

export type RepRestaurantsResult = {
  rows: RestaurantTableRow[];
  counts: { call: number; shop: number; thirdParty: number; siteOnly: number; leaveAlone: number; unchecked: number; total: number };
  /** The newest site read in this city, or null when none has been read. */
  checkedOn: string | null;
  /** The newest sweep touch in this city, or null when it was never swept. */
  sweptOn: string | null;
};

function hostOf(url: string | null): string {
  try {
    return new URL(url ?? '').hostname.replace(/^www\./, '');
  } catch {
    return url ?? '';
  }
}

export async function loadRestaurantsFor(input: { city: string; region?: string | null; code?: string | null; menuHost?: string | null; base?: string }): Promise<RepRestaurantsResult> {
  let q = supabaseAdmin
    .from('outreach_prospects')
    .select('id, business_name, phone, website, rating, review_count, ordering_platform, ordering_checked_at, template_id, categories, last_seen_at')
    .ilike('city', input.city.trim())
    .eq('industry_key', 'restaurant')
    .not('website', 'is', null)
    .neq('website', '')
    .limit(300);
  if (input.region) q = q.ilike('region', input.region.trim());
  const { data } = await q;
  type R = RestaurantRow & { categories: string[] | null; last_seen_at: string | null };
  const base = ((data ?? []) as unknown as R[]).filter((r) => (r.business_name ?? '').trim() && looksLikeFoodBusiness(r.categories));
  const templateIds = base.map((r) => r.template_id).filter((id): id is string => !!id);
  const slugById = new Map<string, string>();
  if (templateIds.length) {
    const { data: tpls } = await supabaseAdmin.from('templates').select('id, slug').in('id', templateIds);
    for (const t of (tpls ?? []) as Array<{ id: string; slug: string | null }>) if (t.slug) slugById.set(t.id, t.slug);
  }
  const groups = groupRestaurantsByOrdering(base);
  // What has already happened to each built row: last text / DM logged, latest Evolve card.
  const marks = await loadOutreachMarks(base.filter((r) => r.template_id).map((r) => r.id)).catch(() => new Map());
  const toRow = (group: RestaurantTableRow['group']) => (r: R): RestaurantTableRow => {
    const slug = r.template_id ? slugById.get(r.template_id) ?? null : null;
    const links = slug && input.code ? repBuildLinks({ slug, industryKey: 'restaurant', prospectId: r.id, code: input.code, base: input.base, menuHost: input.menuHost ?? null }) : null;
    const m = marks.get(r.id);
    return {
      textedAt: m?.textedAt ?? null,
      dmAt: m?.dmAt ?? null,
      cardLine: postcardStatusLine(m?.card),
      prospectId: r.id,
      businessName: (r.business_name ?? '').trim(),
      phone: r.phone,
      websiteHost: hostOf(r.website),
      platformLabel: segmentLabel(r, group),
      group,
      rating: r.rating,
      reviewCount: r.review_count,
      previewUrl: links?.previewUrl ?? null,
      claimUrl: links?.claimUrl ?? null,
      evolveUrl: links?.evolveUrl ?? null,
    };
  };
  const rows: RestaurantTableRow[] = [
    ...groups.call.map(toRow('call')),
    ...groups.shop.map(toRow('shop')),
    ...groups.thirdParty.map(toRow('thirdParty')),
    ...groups.siteOnly.map(toRow('siteOnly')),
    ...groups.unchecked.map(toRow('unchecked')),
    ...groups.leaveAlone.map(toRow('leaveAlone')),
  ];
  const newest = (pick: (r: R) => string | null) => base.reduce<string | null>((m, r) => { const v = pick(r); return v && (!m || v > m) ? v : m; }, null);
  return {
    rows,
    counts: { call: groups.call.length, shop: groups.shop.length, thirdParty: groups.thirdParty.length, siteOnly: groups.siteOnly.length, leaveAlone: groups.leaveAlone.length, unchecked: groups.unchecked.length, total: base.length },
    checkedOn: newest((r) => r.ordering_checked_at),
    sweptOn: newest((r) => r.last_seen_at),
  };
}

/** Has this city been swept for restaurants recently enough that another sweep would only spend? */
export function sweptRecently(sweptOn: string | null, now = Date.now(), days = 7): boolean {
  if (!sweptOn) return false;
  return now - Date.parse(sweptOn) < days * 86_400_000;
}
