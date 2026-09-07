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
  /** host -> campaign id, so the UI can tell adopted inventory from inventory nobody can sell. */
  campaignIdByHost: Record<string, string>;
  /** Set when the site-records lookup failed. Rendered loudly — see the note in loadRateCard. */
  factsError: string | null;
  /** host -> how many prospects are attached to its campaign. Zero is the common, important case. */
  prospectCountByHost: Record<string, number>;
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

  // ⚠️ SELECT THE CONTACT PATH, NOT THE WHOLE `data` BLOB, AND ONLY FOR THE HOSTS WE ASKED ABOUT.
  // The first version of this fetched `data` for every site template: 242 rows averaging 307 kB,
  // one of them 21 MB, ~72 MB in a single request. It failed — and because the error was
  // destructured away, every domain silently lost its facts and the rate card reported "no city,
  // no phone" and the LOWEST price tier for a domain that had all three. A wrong price that looks
  // confident is worse than a page that says it is broken, which is why `factsError` is returned
  // and rendered rather than logged.
  const domainCandidates = sites.flatMap((s) => [s.host, `www.${s.host}`]);
  const slugCandidates = sites.map((s) => s.host.replace(/\.[a-z]+$/, ''));
  const { data: tpls, error: tplErr } = await supabaseAdmin
    .from('templates')
    .select('id, slug, industry, custom_domain, contact:data->identity->contact')
    .or(`custom_domain.in.(${domainCandidates.join(',')}),slug.in.(${slugCandidates.join(',')})`)
    .limit(500);

  const factsError = tplErr ? `Could not load site records: ${tplErr.message}` : null;

  const facts: SiteFacts[] = [];
  for (const t of (tpls ?? []) as any[]) {
    const contact = (t?.contact ?? {}) as Record<string, string | null | undefined>;
    const host = bareHost(t.custom_domain || '') || `${t.slug}.com`;
    facts.push({
      host,
      templateId: t.id ?? null,
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
  const { data: camps } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, domain, subscription_status')
    .limit(2000);
  const campaignIdByHost: Record<string, string> = {};
  const rentedHosts = new Set<string>();
  for (const c of (camps ?? []) as any[]) {
    const h = bareHost(String(c.domain ?? ''));
    if (!h) continue;
    campaignIdByHost[h] = c.id;
    if (['active', 'trialing', 'past_due'].includes(String(c.subscription_status ?? ''))) rentedHosts.add(h);
  }
  const rentedCount = rateRows.filter((r) => rentedHosts.has(r.host)).length;

  // How many businesses are actually attached to each adopted domain. Adopting a domain feels like
  // progress and changes nothing you can mail, so this number decides the next step shown.
  const prospectCountByHost: Record<string, number> = {};
  const campaignIds = Object.values(campaignIdByHost);
  if (campaignIds.length) {
    const { data: props } = await supabaseAdmin
      .from('outreach_prospects')
      .select('geo_campaign_id')
      .in('geo_campaign_id', campaignIds)
      .limit(5000);
    const perCampaign = new Map<string, number>();
    for (const r of (props ?? []) as any[]) {
      const id = String(r.geo_campaign_id ?? '');
      if (id) perCampaign.set(id, (perCampaign.get(id) ?? 0) + 1);
    }
    for (const [host, id] of Object.entries(campaignIdByHost)) {
      prospectCountByHost[host] = perCampaign.get(id) ?? 0;
    }
  }

  return {
    rows: rateRows, window, measuredAt, unreadable, rentedCount, campaignIdByHost, factsError,
    prospectCountByHost,
  };
}
