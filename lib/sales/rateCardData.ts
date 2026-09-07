// lib/sales/rateCardData.ts
//
// Server-side loader: pull the newest Search Console window out of `gsc_cache`, fold it into the
// per-domain shape rateCard.ts expects, and attach each site's own facts from `templates`.
//
// ⚠️ Reads the cache DIRECTLY rather than calling our own API route — a route calling a route is
// the self-HTTP pattern CLAUDE.md §5b bans. Refreshing is the client's job: it posts to
// /api/gsc/performance/all?forceRefresh=true (which re-fetches Google and rewrites this cache),
// then re-renders. So this function always reports what is stored, never what it hoped to fetch.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { buildRateCard, type GscSite, type RateCardRow, type SiteFacts } from '@/lib/sales/rateCard';
import { resolveIndustryKey } from '@/lib/industries';

export type RateCardData = {
  rows: RateCardRow[];
  window: { start: string; end: string } | null;
  measuredAt: string | null;
  /** Properties GSC returned an error for — surfaced, never silently dropped. */
  unreadable: { host: string; error: string }[];
  /**
   * How many of these domains are actually rented right now, derived from live subscriptions.
   * ⚠️ Carried in the same payload as the valuation ON PURPOSE — a capacity figure without this
   * number beside it reads as revenue, and this is the number that stops that happening.
   */
  rentedCount: number;
};

/** GSC property id -> bare host: "https://www.x.com/" and "sc-domain:x.com" both become "x.com". */
export function bareHost(property: string): string {
  return String(property ?? '')
    .replace(/^sc-domain:/, '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

type CacheRow = { domain: string; start_date: string; end_date: string; data: any; created_at: string };

export async function loadRateCard(): Promise<RateCardData> {
  const { data: cache } = await supabaseAdmin
    .from('gsc_cache')
    .select('domain, start_date, end_date, data, created_at')
    .order('created_at', { ascending: false })
    .limit(400);

  const rowsByProperty = new Map<string, CacheRow>();
  for (const r of (cache ?? []) as CacheRow[]) {
    // Skip the pre-rolled summary rows the report script writes; we want per-query detail.
    if (r.domain.startsWith('sum:')) continue;
    // Newest first, so the first sighting of a property is the one to keep.
    if (!rowsByProperty.has(r.domain)) rowsByProperty.set(r.domain, r);
  }

  const unreadable: { host: string; error: string }[] = [];
  const sites: GscSite[] = [];
  let window: { start: string; end: string } | null = null;
  let measuredAt: string | null = null;

  for (const [property, row] of rowsByProperty) {
    const host = bareHost(property);
    if (host.includes('quicksites.ai')) continue; // our own brand proves nothing about a geo domain

    if (!Array.isArray(row.data)) {
      unreadable.push({ host, error: row.data?.error ? String(row.data.error) : 'no rows returned' });
      continue;
    }
    if (!window) window = { start: row.start_date, end: row.end_date };
    if (!measuredAt || row.created_at > measuredAt) measuredAt = row.created_at;

    // The cache is keyed by (page, query); one query can appear on several pages. Fold to the
    // query, summing volume and averaging position WEIGHTED BY IMPRESSIONS — a plain mean would
    // let a 1-impression page at position 2 outvote a 100-impression page at position 30.
    const byQuery = new Map<string, { clicks: number; impressions: number; posWeighted: number }>();
    for (const d of row.data) {
      const q = String(d?.query ?? '').trim();
      if (!q) continue;
      const impressions = Number(d?.impressions) || 0;
      const cur = byQuery.get(q) ?? { clicks: 0, impressions: 0, posWeighted: 0 };
      cur.clicks += Number(d?.clicks) || 0;
      cur.impressions += impressions;
      cur.posWeighted += (Number(d?.position) || 0) * impressions;
      byQuery.set(q, cur);
    }

    const queries = [...byQuery.entries()].map(([query, v]) => ({
      query,
      clicks: v.clicks,
      impressions: v.impressions,
      position: v.impressions > 0 ? v.posWeighted / v.impressions : 0,
    }));

    const impressions = queries.reduce((a, q) => a + q.impressions, 0);
    sites.push({
      host,
      clicks: queries.reduce((a, q) => a + q.clicks, 0),
      impressions,
      position: impressions > 0
        ? Math.round((queries.reduce((a, q) => a + q.position * q.impressions, 0) / impressions) * 10) / 10
        : null,
      queries,
    });
  }

  const { data: tpls } = await supabaseAdmin
    .from('templates')
    .select('slug, industry, custom_domain, data')
    .eq('is_site', true)
    .limit(2000);

  const facts: SiteFacts[] = [];
  for (const t of (tpls ?? []) as any[]) {
    const contact = t?.data?.identity?.contact ?? {};
    const host = bareHost(t.custom_domain || '') || `${t.slug}.com`;
    facts.push({
      host,
      slug: t.slug ?? null,
      city: contact.city ?? null,
      state: contact.state ?? null,
      phone: contact.phone ?? null,
      industryKey: (resolveIndustryKey(t.industry) ?? null) as any,
    });
  }

  const rateRows = buildRateCard(sites, facts);

  // Rented = a campaign on one of these domains carrying a live subscription. Derived rather than
  // assumed: the proven domains are not currently campaigns at all, so this SHOULD be zero — and a
  // hardcoded zero would keep reading zero on the day one of them sells.
  const { data: subs } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('domain, subscription_status')
    .in('subscription_status', ['active', 'trialing', 'past_due']);
  const rentedHosts = new Set((subs ?? []).map((c: any) => bareHost(String(c.domain ?? ''))));
  const rentedCount = rateRows.filter((r) => rentedHosts.has(r.host)).length;

  return { rows: rateRows, window, measuredAt, unreadable, rentedCount };
}
