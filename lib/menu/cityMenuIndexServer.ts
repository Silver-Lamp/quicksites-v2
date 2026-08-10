// lib/menu/cityMenuIndexServer.ts
//
// Build a city's dish index on the SERVER, so it is in the bytes we ship.
//
// ⚠️ THIS IS THE SAME WORK `/api/public/city-menu-search` DOES, CALLED DIRECTLY. The route stays —
// the block still refetches after hydration, so an open/closed change or a newly claimed kitchen
// is never stale. This decides only what the FIRST render contains, which is what a crawler and a
// no-JS visitor get, and until now that was nothing at all.
//
// ⚠️ IT IS NOT A SNAPSHOT AND MUST NOT BECOME ONE. `restaurants_directory` stores its entries in
// block content for instant paint, which is fine for a handful of rows that change when an
// operator says so. Doing that with MENUS would freeze dish lists at publish time — the staleness
// this codebase already fights in menuFreshness, where a price we cannot date is not quoted as
// fact. Fetched per request, written down nowhere.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { loadCompetitionDirectoryByCampaignId } from '@/lib/outreach/restaurantCompetitionDirectory';
import { getHiddenTemplateIds } from '@/lib/outreach/directoryCuration';
import { buildCityMenuIndex, type CityMenuIndex } from './cityMenuIndex';
import { selectUnclaimedForCity } from './unclaimedNearby';
import { menuSiteUrl } from './deliveredMenu';

export type CityMenuFeed = CityMenuIndex & { city: string; region?: string | null };

/** The campaign id a `menu_finder` block is pointed at, if the page has one. */
export function menuFinderCampaignId(data: any): string | null {
  for (const page of data?.pages ?? []) {
    for (const arr of [page?.content_blocks, page?.blocks]) {
      for (const b of arr ?? []) {
        if (b?.type !== 'menu_finder') continue;
        const id = b?.content?.campaign_id;
        if (typeof id === 'string' && id.trim()) return id.trim();
      }
    }
  }
  return null;
}

/**
 * The index for one campaign, or null.
 *
 * ⚠️ Returns null on ANY failure rather than throwing. This runs inside a public page render, and
 * a directory lookup that errors must degrade to "the search hydrates a moment later" — the
 * behaviour we had before — never to a 500 on a restaurant's front door.
 */
export async function loadCityMenuFeed(campaignId: string): Promise<CityMenuFeed | null> {
  try {
    const dir = await loadCompetitionDirectoryByCampaignId(campaignId);
    if (!dir) return null;

    const { data: templates } = await supabaseAdmin
      .from('templates')
      .select('id, slug, data')
      .in('id', dir.entries.map((e) => e.templateId));
    const byId = new Map((templates ?? []).map((t: any) => [t.id, t]));

    const listed = dir.entries
      .map((e) => {
        const t: any = byId.get(e.templateId);
        return t ? { slug: e.slug, name: e.businessName, url: e.url, data: t.data } : null;
      })
      .filter(Boolean) as any[];

    const [{ data: drafts }, hidden] = await Promise.all([
      supabaseAdmin
        .from('templates')
        .select('id, slug, data')
        .eq('claim_source', 'listing_import')
        .limit(500),
      getHiddenTemplateIds(campaignId),
    ]);

    const unclaimed = selectUnclaimedForCity((drafts ?? []) as any[], {
      city: dir.city,
      region: dir.region,
      excludeTemplateIds: dir.entries.map((e) => e.templateId),
      hiddenTemplateIds: hidden,
      urlFor: (slug) => menuSiteUrl(slug),
    });

    if (!listed.length && !unclaimed.length) return null;

    return { city: dir.city, region: dir.region, ...buildCityMenuIndex([...listed, ...unclaimed]) };
  } catch {
    return null;
  }
}
