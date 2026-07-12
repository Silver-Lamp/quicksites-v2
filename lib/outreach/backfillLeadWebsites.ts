// lib/outreach/backfillLeadWebsites.ts
//
// Migrated legacy leads land as 'no_website' (the leads table stored no site). This backfill
// looks each one up by name+location via Places Text Search to find whether it actually has a
// website, and if so freshness-scores it and re-tiers it (dated / has_site). Paid: one Places
// Text Search call per prospect. Only touches source='legacy_lead' prospects still 'no_website'.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { searchPlaceByText } from '@/lib/places/searchText';
import { scoreSiteFreshness } from '@/lib/rebuild/siteFreshness';
import { classifyLeadTier } from '@/lib/outreach/prospects';

type Row = { id: string; business_name: string; city: string | null; region: string | null };

export type BackfillResult = {
  scanned: number;
  siteFound: number;
  reclassified: { has_site: number; dated: number };
  stillNoWebsite: number;
  errors: number;
};

/** Look up migrated leads' websites and re-tier the ones that actually have a site. */
export async function backfillLeadWebsites(limit = 200): Promise<BackfillResult> {
  const { data, error } = await supabaseAdmin
    .from('outreach_prospects')
    .select('id, business_name, city, region')
    .eq('source', 'legacy_lead')
    .eq('lead_tier', 'no_website')
    .limit(limit);
  if (error) throw new Error(`backfillLeadWebsites: read failed: ${error.message}`);
  const rows = (data as Row[]) ?? [];

  const result: BackfillResult = { scanned: rows.length, siteFound: 0, reclassified: { has_site: 0, dated: 0 }, stillNoWebsite: 0, errors: 0 };

  for (const r of rows) {
    try {
      const query = [r.business_name, r.city, r.region].filter(Boolean).join(', ');
      const match = await searchPlaceByText(query);
      if (!match?.website) {
        result.stillNoWebsite += 1;
        continue;
      }
      result.siteFound += 1;
      const fresh = await scoreSiteFreshness(match.website).catch(() => null);
      const tier = classifyLeadTier(match.website, fresh?.score ?? null);
      await supabaseAdmin
        .from('outreach_prospects')
        .update({
          website: match.website,
          freshness_score: fresh?.score ?? null,
          freshness_signals: fresh?.signals ?? [],
          lead_tier: tier,
          rating: match.rating,
          review_count: match.reviewCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', r.id);
      if (tier === 'has_site') result.reclassified.has_site += 1;
      else if (tier === 'dated') result.reclassified.dated += 1;
    } catch {
      result.errors += 1;
    }
  }
  return result;
}
