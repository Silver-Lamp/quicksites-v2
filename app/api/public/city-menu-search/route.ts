// app/api/public/city-menu-search/route.ts
//
// The searchable menu index for one city cohort — every dish across every listed restaurant,
// with its tags, price and whether that kitchen is open right now.
//
// GET ?campaign=<id>  → { city, items[], tags[], restaurants[] }
//
// Public and read-only, like the directory feed beside it. It reuses
// loadCompetitionDirectoryByCampaignId so the search can NEVER show a restaurant the directory
// hides: buffet exclusion and operator curation are applied once, in one place, and this
// inherits both. A search that surfaced a hidden restaurant would quietly undo the curation.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { loadCompetitionDirectoryByCampaignId } from '@/lib/outreach/restaurantCompetitionDirectory';
import { buildCityMenuIndex } from '@/lib/menu/cityMenuIndex';
import { selectUnclaimedForCity } from '@/lib/menu/unclaimedNearby';
import { getHiddenTemplateIds } from '@/lib/outreach/directoryCuration';
import { menuSiteUrl } from '@/lib/menu/deliveredMenu';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const campaign = (new URL(req.url).searchParams.get('campaign') || '').trim();
  if (!campaign) return NextResponse.json({ error: 'campaign is required' }, { status: 400 });

  const dir = await loadCompetitionDirectoryByCampaignId(campaign);
  if (!dir) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { data: templates } = await supabaseAdmin
    .from('templates')
    .select('id, slug, data')
    .in('id', dir.entries.map((e) => e.templateId));
  const byId = new Map((templates ?? []).map((t: any) => [t.id, t]));

  const listed = dir.entries
    .map((e) => {
      const t: any = byId.get(e.templateId);
      if (!t) return null;
      return { slug: e.slug, name: e.businessName, url: e.url, data: t.data };
    })
    .filter(Boolean) as any[];

  // ⚠️ Unclaimed drafts are appended AFTER the listed cohort and FLAGGED, never merged into it.
  // See lib/menu/unclaimedNearby.ts for why they belong here and why they must not look the same.
  // Hidden ids are subtracted so this second data path cannot quietly undo operator curation —
  // the standing rule at the top of this file is that search never shows what the directory hides.
  const [{ data: drafts }, hidden] = await Promise.all([
    supabaseAdmin
      .from('templates')
      .select('id, slug, data')
      .eq('claim_source', 'listing_import')
      .limit(500),
    getHiddenTemplateIds(campaign),
  ]);

  const unclaimed = selectUnclaimedForCity((drafts ?? []) as any[], {
    city: dir.city,
    region: dir.region,
    excludeTemplateIds: dir.entries.map((e) => e.templateId),
    hiddenTemplateIds: hidden,
    urlFor: (slug) => menuSiteUrl(slug),
  });

  if (!listed.length && !unclaimed.length) {
    return NextResponse.json({ city: dir.city, region: dir.region, items: [], tags: [], restaurants: [] });
  }

  const index = buildCityMenuIndex([...listed, ...unclaimed]);
  return NextResponse.json({ city: dir.city, region: dir.region, ...index });
}
