// lib/prospects/runSweep.ts
//
// The geographic fan-out, as a function: sweep businesses near a point, tier them by website
// presence / freshness, park them as prospects. CHEAP — Places calls + a best-effort site fetch
// per business that has a website; NO AI spend. Extracted from the discover route so the nightly
// pipeline (lib/tradeSites/pipeline.ts) runs exactly what the operator's button runs.
import { searchNearby, type NearbyBusiness } from '@/lib/places/searchNearby';
import { searchTextNearby } from '@/lib/places/searchTextNearby';
import { scoreSiteFreshness } from '@/lib/rebuild/siteFreshness';
import { classifyLeadTier, upsertProspects, type ProspectInput, type LeadTier } from '@/lib/outreach/prospects';
import { backfillPlaceSignals, placeSignalsBackfillOnSweepEnabled, placeSignalsBackfillLimit } from '@/lib/outreach/placeSignals';
import { getLatLonForCityState } from '@/lib/utils/geocode';
import { typeToIndustryKey } from '@/lib/places/typeToIndustry';

export type SweepInput = {
  lat?: number;
  lon?: number;
  city: string;
  region: string;
  radiusMeters?: number;
  includedTypes: string[];
  textCategories: { query: string; industry?: string }[];
  sweepId?: string;
  operatorId: string | null;
};

export type SweepResult = {
  sweepId: string;
  inserted: number;
  found: number;
  tallies: Record<string, number>;
  signals: Awaited<ReturnType<typeof backfillPlaceSignals>> | null;
  /** Prospect inputs as parked — the pipeline builds from the no-website ones straight away. */
  rows: ProspectInput[];
};

export class SweepInputError extends Error {}

function uuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id_${Math.random().toString(36).slice(2)}${Date.now()}`;
}

/** Score up to `limit` websites at a time to bound outbound fetch concurrency. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Throws PlacesError (from the Places client) or SweepInputError; the caller maps them to HTTP. */
export async function runSweep(input: SweepInput): Promise<SweepResult> {
  let { lat, lon } = input;
  const city = input.city.trim();
  const region = input.region.trim();
  const radiusMeters = input.radiusMeters || 1500;
  if (!input.includedTypes.length && !input.textCategories.length) {
    throw new SweepInputError('Pick at least one business category.');
  }
  if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && city) {
    const geo = await getLatLonForCityState(city, region || undefined);
    if (geo) {
      lat = geo.lat;
      lon = geo.lon;
    }
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new SweepInputError('Provide a city (or a valid lat/lon) to sweep.');
  }

  const sweepId = input.sweepId || uuid();
  const textQueries = input.textCategories.map((c) => c.query);
  const industryByQuery = new Map<string, string>(input.textCategories.map((c) => [c.query, c.industry ?? '']));

  // 1) Sweep — Nearby Search for typed categories + Text Search for keyword categories, merged
  //    and deduped by place id. Text results carry an industryHint used to classify them.
  type SweepBusiness = NearbyBusiness & { industryHint?: string };
  const [byType, byText] = await Promise.all([
    input.includedTypes.length ? searchNearby({ lat: lat!, lon: lon!, radiusMeters, includedTypes: input.includedTypes }) : Promise.resolve([]),
    textQueries.length ? searchTextNearby({ lat: lat!, lon: lon!, radiusMeters, textQueries }) : Promise.resolve([]),
  ]);
  const byPlaceId = new Map<string, SweepBusiness>();
  for (const b of byType) if (!byPlaceId.has(b.placeId)) byPlaceId.set(b.placeId, b);
  for (const b of byText) {
    if (byPlaceId.has(b.placeId)) continue;
    byPlaceId.set(b.placeId, { ...b, industryHint: industryByQuery.get(b.matchedQuery) || undefined });
  }
  const businesses = [...byPlaceId.values()];

  // 2) Score freshness for any business that HAS a website; no-website skips straight to the top tier.
  const rows = await mapLimit(businesses, 6, async (b) => {
    let freshnessScore: number | null = null;
    let freshnessSignals: string[] = [];
    let tier: LeadTier;
    if (b.website) {
      const f = await scoreSiteFreshness(b.website);
      freshnessScore = f.reachable ? f.score : null;
      freshnessSignals = f.reachable ? f.signals : [];
      tier = classifyLeadTier(b.website, freshnessScore);
    } else {
      tier = 'no_website';
    }
    const row: ProspectInput = {
      placeId: b.placeId,
      businessName: b.name,
      phone: b.phone,
      address: b.address,
      lat: b.lat,
      lon: b.lon,
      city: city || null,
      region: region || null,
      industryKey: typeToIndustryKey(b.types, (b.industryHint as any) || undefined),
      categories: b.types,
      website: b.website,
      freshnessScore,
      freshnessSignals,
      leadTier: tier,
      sweepId,
      discoveredBy: input.operatorId ?? undefined,
    } as ProspectInput;
    return row;
  });

  // 3) Park them (dedupe on place_id — re-sweeps never clobber worked leads).
  const inserted = await upsertProspects(rows);

  // 3b) Paid Place Details signals — flag-gated OFF, bounded, best-effort.
  let signals: SweepResult['signals'] = null;
  if (placeSignalsBackfillOnSweepEnabled()) {
    try {
      signals = await backfillPlaceSignals(rows.map((s) => s.placeId), { limit: placeSignalsBackfillLimit() });
    } catch {
      signals = null;
    }
  }

  const tallies = rows.reduce(
    (acc, r) => {
      acc[r.leadTier] += 1;
      acc.total += 1;
      return acc;
    },
    { no_website: 0, dated: 0, has_site: 0, total: 0 } as Record<string, number>,
  );

  return { sweepId, inserted, found: rows.length, tallies, signals, rows };
}
