// app/api/admin/prospects/discover/route.ts
//
// The geographic fan-out: sweep businesses near a point, filter by website presence /
// freshness into lead tiers, and park them as prospects. CHEAP — Places calls + a
// best-effort site fetch per business with a website; NO AI spend. The operator then
// selectively builds draft sites from the prospect list (/api/admin/prospects/build).

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { searchNearby, PlacesError, type NearbyBusiness } from '@/lib/places/searchNearby';
import { searchTextNearby } from '@/lib/places/searchTextNearby';
import { scoreSiteFreshness } from '@/lib/rebuild/siteFreshness';
import { classifyLeadTier, upsertProspects, type ProspectInput, type LeadTier } from '@/lib/outreach/prospects';
import { getLatLonForCityState } from '@/lib/utils/geocode';
import { typeToIndustryKey } from '@/lib/places/typeToIndustry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // a sweep can fetch many prospect sites to score

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

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const limited = await rateLimitOr429(req, 'prospects-discover', 20, 3600);
  if (limited) return limited;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  let lat = Number(body.lat);
  let lon = Number(body.lon);
  const city = typeof body.city === 'string' ? body.city.trim() : '';
  const region = typeof body.region === 'string' ? body.region.trim() : '';
  const radiusMeters = Number(body.radiusMeters) || 1500;
  const includedTypes: string[] = Array.isArray(body.includedTypes)
    ? body.includedTypes.map(String).filter(Boolean)
    : [];
  // Keyword categories (towing, HVAC, landscaping, …) have no Places type, so they
  // come through as free-text queries run via Text Search. Each carries the industry
  // key it represents, so a keyword-found business is classified correctly (a towing
  // co whose Places types are generic would otherwise fall back to 'restaurant').
  const textCategories: { query: string; industry?: string }[] = Array.isArray(body.textCategories)
    ? body.textCategories
        .map((c: any) => ({ query: String(c?.query ?? '').trim(), industry: c?.industry ? String(c.industry) : undefined }))
        .filter((c: any) => c.query)
    : [];
  const textQueries = textCategories.map((c) => c.query);
  const industryByQuery = new Map<string, string>(textCategories.map((c) => [c.query, c.industry ?? '']));
  if (!includedTypes.length && !textQueries.length) {
    return NextResponse.json({ error: 'Pick at least one business category.' }, { status: 400 });
  }

  // Geocode a city name when no explicit lat/lon was given.
  if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && city) {
    const geo = await getLatLonForCityState(city, region || undefined);
    if (geo) {
      lat = geo.lat;
      lon = geo.lon;
    }
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: 'Provide a city (or a valid lat/lon) to sweep.' }, { status: 400 });
  }

  const sweepId = typeof body.sweepId === 'string' && body.sweepId ? body.sweepId : uuid();

  // 1) Sweep — Nearby Search for typed categories + Text Search for keyword
  //    categories, merged and deduped by place id. Text results carry an
  //    industryHint (from the query that matched) used to classify them.
  type SweepBusiness = NearbyBusiness & { industryHint?: string };
  let businesses: SweepBusiness[];
  try {
    const [byType, byText] = await Promise.all([
      includedTypes.length ? searchNearby({ lat, lon, radiusMeters, includedTypes }) : Promise.resolve([]),
      textQueries.length ? searchTextNearby({ lat, lon, radiusMeters, textQueries }) : Promise.resolve([]),
    ]);
    const byPlaceId = new Map<string, SweepBusiness>();
    // Typed results first (a precise place type beats a keyword guess on dedupe).
    for (const b of byType) if (!byPlaceId.has(b.placeId)) byPlaceId.set(b.placeId, b);
    for (const b of byText) {
      if (byPlaceId.has(b.placeId)) continue;
      const industryHint = industryByQuery.get(b.matchedQuery) || undefined;
      byPlaceId.set(b.placeId, { ...b, industryHint });
    }
    businesses = [...byPlaceId.values()];
  } catch (e) {
    if (e instanceof PlacesError) {
      const status = e.code === 'not_configured' ? 501 : e.code === 'invalid' ? 400 : 502;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    return NextResponse.json({ error: 'Sweep failed.' }, { status: 500 });
  }

  // 2) Score freshness for any business that HAS a website (bounded concurrency);
  //    no-website businesses skip straight to the top lead tier with no fetch.
  const scored = await mapLimit(businesses, 6, async (b) => {
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
      // Prefer a concrete Places type; else fall back to the keyword category's
      // industry (so towing/HVAC/etc. don't default to 'restaurant').
      industryKey: typeToIndustryKey(b.types, (b.industryHint as any) || undefined),
      categories: b.types,
      website: b.website,
      freshnessScore,
      freshnessSignals,
      leadTier: tier,
      sweepId,
      discoveredBy: operator.id,
    };
    return row;
  });

  // 3) Park them (dedupe on place_id — re-sweeps never clobber worked leads).
  const inserted = await upsertProspects(scored);

  const tallies = scored.reduce(
    (acc, r) => {
      acc[r.leadTier] += 1;
      acc.total += 1;
      return acc;
    },
    { no_website: 0, dated: 0, has_site: 0, total: 0 } as Record<string, number>,
  );

  return NextResponse.json({ ok: true, sweepId, inserted, found: scored.length, tallies });
}
