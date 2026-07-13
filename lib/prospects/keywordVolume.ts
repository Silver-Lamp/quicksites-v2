// lib/prospects/keywordVolume.ts
//
// Optional keyword-search-volume enrichment for the domain buy-list — the one Niche-Finder
// signal we can't derive from swept data (it needs a keyword-volume source). Flag-gated and
// graceful: OFF unless KEYWORD_VOLUME_ENABLED=1 + DataForSEO creds are set; returns {} when
// disabled/unconfigured/on error, so the planner never depends on it. Costs money per call,
// so the route only enriches the top-N candidates on explicit opt-in. See
// docs/DOMAIN_ACQUISITION_PLAN.md §7.

import type { IndustryKey } from '@/lib/industries';
import { industryDomainWord } from '@/lib/outreach/geoDomain';
import type { BuyCandidate } from '@/lib/prospects/buyList';

export function keywordVolumeConfigured(): boolean {
  return !!(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);
}

export function keywordVolumeEnabled(): boolean {
  const flag = process.env.KEYWORD_VOLUME_ENABLED;
  return (flag === '1' || flag === 'true') && keywordVolumeConfigured();
}

/** The local keyword we price for a candidate, e.g. "gallatin towing", "renton auto glass". */
export function keywordForCandidate(city: string, industryKey: string): string {
  const service = industryDomainWord(industryKey as IndustryKey).replace(/-/g, ' ');
  return `${city} ${service}`.toLowerCase().replace(/\s+/g, ' ').trim();
}

type VolItem = { domain: string; city: string; industryKey: string };

/**
 * Fetch monthly search volume per candidate domain from DataForSEO (Google Ads search
 * volume, live). One call for the whole batch. Never throws — returns {} on any failure so
 * the caller degrades to unenriched scoring.
 */
export async function fetchKeywordVolumes(items: VolItem[]): Promise<Record<string, number>> {
  if (!keywordVolumeEnabled() || !items.length) return {};

  const auth = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`,
  ).toString('base64');
  const locationCode = Number(process.env.DATAFORSEO_LOCATION_CODE) || 2840; // US

  const kwByDomain = new Map<string, string>();
  const keywords = new Set<string>();
  for (const it of items) {
    const kw = keywordForCandidate(it.city, it.industryKey);
    kwByDomain.set(it.domain, kw);
    keywords.add(kw);
  }

  try {
    const res = await fetch(
      'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live',
      {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([{ location_code: locationCode, language_code: 'en', keywords: [...keywords] }]),
        cache: 'no-store',
      },
    );
    if (!res.ok) return {};
    const json: any = await res.json();
    const rows: any[] = json?.tasks?.[0]?.result ?? [];
    const volByKw = new Map<string, number>();
    for (const r of rows) {
      if (r?.keyword != null) {
        volByKw.set(String(r.keyword).toLowerCase(), typeof r.search_volume === 'number' ? r.search_volume : 0);
      }
    }
    const out: Record<string, number> = {};
    for (const it of items) {
      const v = volByKw.get(kwByDomain.get(it.domain)!);
      if (typeof v === 'number') out[it.domain] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export type ApplyVolumeOptions = {
  /** How much max search volume can boost a candidate's score (default 0.3). */
  volumeWeight?: number;
  /** Monthly volume treated as "medium" — the boost curve's midpoint (default 200). */
  volumeMidpoint?: number;
};

/**
 * Pure: fold search volume into candidate scores and re-rank. A higher-volume market is a
 * more valuable domain, so volume only *boosts* (1 → 1+volumeWeight); no data → factor 1
 * (unchanged). Returns new candidates sorted by the volume-adjusted score.
 */
export function applyKeywordVolume(
  candidates: BuyCandidate[],
  volumeByDomain: Record<string, number>,
  opts: ApplyVolumeOptions = {},
): BuyCandidate[] {
  const volumeWeight = opts.volumeWeight ?? 0.3;
  const midpoint = opts.volumeMidpoint ?? 200;

  const out = candidates.map((c) => {
    const v = volumeByDomain[c.domain];
    if (typeof v !== 'number') return { ...c, searchVolume: null, volumeFactor: 1 };
    const strength = v / (v + midpoint); // saturating 0..1
    const volumeFactor = 1 + volumeWeight * strength;
    // Rescale from the base (undo any prior volumeFactor so this is idempotent).
    const baseScore = c.score / (c.volumeFactor || 1);
    return { ...c, searchVolume: v, volumeFactor, score: baseScore * volumeFactor };
  });

  return out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.noWebsite !== a.noWebsite) return b.noWebsite - a.noWebsite;
    return a.domain.localeCompare(b.domain);
  });
}
