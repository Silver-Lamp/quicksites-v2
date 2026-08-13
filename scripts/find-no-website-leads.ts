// scripts/find-no-website-leads.ts
//
// Build a REAL "no website" restaurant lead list for the CedarSites importer.
//
// ⚠️ THE OLD leads.json WAS THE WRONG COHORT AND WOULD HAVE ANSWERED THE WRONG QUESTION.
// It listed Canlis, The Pink Door, Six Seven — famous Seattle restaurants that mostly HAVE
// websites. Running the menu auto-detect hit-rate over them measures how well we read menus for
// businesses that already have a web presence, which is not the funnel: the funnel is
// restaurants with NOTHING, whose only public artifact is a Google listing and whatever photos
// diners happened to upload. Those two populations have completely different menu-photo
// availability, and that availability IS the number being measured. A tidy percentage from the
// wrong cohort is worse than no percentage, because it looks like an answer.
//
// So: sweep a city, keep only businesses Places reports with no website, emit leads.json.
//
// Places charges per request. This is a handful of Text Search calls (20 results each), not
// per-business lookups — cents, not dollars. The expensive step is the importer that follows.
//
//   npx tsx --env-file=.env.local scripts/find-no-website-leads.ts --city "Renton, WA" \
//     --lat 47.4829 --lon -122.2171 [--industry deck_builder] [--radius 8000] [--max-km 15] [--limit 25] [--out leads.json]
//
// --industry defaults to `restaurant`. Sets live in lib/prospects/sweepQueries.ts; an unknown one
// FAILS rather than falling back, because a generic query set measures the wrong population.

import fs from 'node:fs';
import { searchTextNearby } from '../lib/places/searchTextNearby';
import { queriesFor, sweepableIndustries } from '../lib/prospects/sweepQueries';

/** Great-circle km between two points. */
function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

// ⚠️ QUERIES MOVED TO lib/prospects/sweepQueries.ts, one set per industry. They were hardcoded to
// restaurants here, which made this script silently restaurant-only — running it for deck builders
// would have swept restaurants and reported a deck-builder cohort.

async function main() {
  const city = arg('city') ?? 'unknown';
  const lat = Number(arg('lat'));
  const lon = Number(arg('lon'));
  const radiusMeters = Number(arg('radius', '8000'));
  const limit = Number(arg('limit', '25'));
  const out = arg('out', 'leads.json')!;
  const industry = (arg('industry', 'restaurant') as any)!;

  let QUERIES: string[];
  try {
    QUERIES = queriesFor(industry);
  } catch (e: any) {
    console.error(e.message);
    console.error(`\nSweepable industries: ${sweepableIndustries().join(', ')}`);
    process.exit(1);
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('--lat and --lon are required (a real point, not a guessed one).');
  }

  console.log(`Sweeping ${city} for ${industry} (${lat}, ${lon}) r=${radiusMeters}m across ${QUERIES.length} queries…`);
  const found = await searchTextNearby({ lat, lon, radiusMeters, textQueries: QUERIES });

  // ⚠️ `website: null` is Places reporting no website field — which is the definition of the
  // cohort, and also the only signal available. A business with a Facebook page and no site
  // still counts, correctly: they have no site to send a customer to.
  // ⚠️ PLACES DOES NOT HONOUR THE RADIUS, AND THE SPILL IS NOT "SLIGHT".
  // Text Search circles can only be a locationBias (locationRestriction takes a rectangle), so
  // results leak far outside. Measured over eight real sweeps: 10% out-of-city for Naples, 61% for
  // Union City, 64% for a Renton deck sweep — which returned a builder in SHELTON, ~60 miles away.
  //
  // For restaurants that is mildly wrong; people cross a city line for dinner. For a TRADE it breaks
  // the premise: a homeowner on renton-decks.com does not want a 60-mile builder, and the
  // competition pitch ("you're up against the other Renton builders") is simply false if most of the
  // cohort is not in Renton. So distance is filtered here, and the drops are REPORTED — a silently
  // tightened cohort is the same failure as a silently capped one.
  const maxKm = Number(arg('max-km', '')) || null;
  const withinRange = maxKm
    ? found.filter((b) => {
        if (b.lat == null || b.lon == null) return true; // unknown location: keep, do not guess
        return haversineKm(lat, lon, b.lat, b.lon) <= maxKm;
      })
    : found;
  if (maxKm && withinRange.length < found.length) {
    console.log(`  ⚠️ dropped ${found.length - withinRange.length} beyond ${maxKm}km of the centre`);
  }

  const noWebsite = withinRange.filter((b) => !b.website);
  const withWebsite = withinRange.length - noWebsite.length;

  console.log(`  ${found.length} found · ${withinRange.length} within range · ${noWebsite.length} with no website · ${withWebsite} with one`);

  const picked = noWebsite.slice(0, limit);
  // ⚠️ Report the truncation. A silently capped list reads downstream as "this is what the city
  // has", and the hit-rate would then be quoted over a sample nobody knows was cut.
  if (noWebsite.length > limit) {
    console.log(`  ⚠️ capping at ${limit} of ${noWebsite.length} — the rest are NOT in ${out}`);
  }

  const leads = picked.map((b) => ({
    placeId: b.placeId,
    // Kept so a later step can re-check distance without re-querying Places.
    _km: b.lat != null && b.lon != null ? Math.round(haversineKm(lat, lon, b.lat, b.lon) * 10) / 10 : null,
    // Carried for the hook-finding step. For a vertical with no menu (auto shops), a shop's own
    // reviews are the closest thing to "their own words" we can honestly reference.
    _rating: b.rating ?? null,
    _reviews: b.reviewCount ?? null,
    // Kept for the human reading the file; the importer uses placeId.
    _name: b.name,
    _address: b.address ?? null,
  }));

  fs.writeFileSync(out, JSON.stringify(leads, null, 2));
  console.log(`\nWrote ${out} with ${leads.length} no-website leads.`);
  for (const l of leads) {
    const stars = l._rating != null ? ` ${l._rating}★${l._reviews != null ? `/${l._reviews}` : ''}` : ' (unrated)';
    console.log(`  · ${l._name}${l._km != null ? ` [${l._km}km]` : ''}${stars}${l._address ? ` — ${l._address}` : ''}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
