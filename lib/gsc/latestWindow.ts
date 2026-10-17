// lib/gsc/latestWindow.ts — the harvest is a ROLLING WINDOW captured daily; sum one capture.
//
// ⚠️ `gsc_queries` holds, for every domain, one row per query per CAPTURE, and each capture is
// Google's 28-day aggregate for that query. Summing every row for a domain therefore adds the
// same 28 days roughly thirty times. On 2026-10-16 that read as "richland-towing.com: 2,247
// impressions, 100 clicks" in the call analysis, the forward-to suggestions and the corpus
// section — the true latest window was 64 impressions and 4 clicks. A recommendation to buy
// numbers for "page-one domains with demand" was built on it. Every reader goes through this.
import { normalizeGscDomain } from '@/lib/gsc/normalizeDomain';

export type HarvestRow = { domain: string; end_date: string; impressions: number | null; clicks: number | null };
export type WindowTotals = { impressions: number; clicks: number; endDate: string; queries: number };

/** Per normalised host: the totals of the LATEST capture only (max end_date), never a sum across captures. */
export function latestWindowTotals(rows: HarvestRow[]): Map<string, WindowTotals> {
  const latest = new Map<string, string>();
  for (const r of rows) {
    const host = normalizeGscDomain(r.domain);
    if (!host || !r.end_date) continue;
    const cur = latest.get(host);
    if (!cur || r.end_date > cur) latest.set(host, r.end_date);
  }
  const out = new Map<string, WindowTotals>();
  for (const r of rows) {
    const host = normalizeGscDomain(r.domain);
    if (!host || latest.get(host) !== r.end_date) continue;
    const e = out.get(host) ?? { impressions: 0, clicks: 0, endDate: r.end_date, queries: 0 };
    e.impressions += r.impressions ?? 0;
    e.clicks += r.clicks ?? 0;
    e.queries += 1;
    out.set(host, e);
  }
  return out;
}

/** Convenience for one domain. */
export function latestWindowFor(rows: HarvestRow[], domain: string): WindowTotals | null {
  return latestWindowTotals(rows).get(normalizeGscDomain(domain)) ?? null;
}
