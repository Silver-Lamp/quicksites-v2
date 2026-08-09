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
//     --lat 47.4829 --lon -122.2171 [--radius 8000] [--limit 25] [--out leads.json]

import fs from 'node:fs';
import { searchTextNearby } from '../lib/places/searchTextNearby';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

// Broad enough to catch the independents that skip websites — the taquerias, the counter
// places, the family kitchens — not just what Google files under "restaurant".
const QUERIES = [
  'restaurant',
  'taqueria',
  'pizza',
  'chinese restaurant',
  'thai restaurant',
  'mexican restaurant',
  'vietnamese restaurant',
  'indian restaurant',
  'teriyaki',
  'deli',
  'diner',
  'bbq',
  'sandwich shop',
  'bakery',
];

async function main() {
  const city = arg('city') ?? 'unknown';
  const lat = Number(arg('lat'));
  const lon = Number(arg('lon'));
  const radiusMeters = Number(arg('radius', '8000'));
  const limit = Number(arg('limit', '25'));
  const out = arg('out', 'leads.json')!;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('--lat and --lon are required (a real point, not a guessed one).');
  }

  console.log(`Sweeping ${city} (${lat}, ${lon}) r=${radiusMeters}m across ${QUERIES.length} queries…`);
  const found = await searchTextNearby({ lat, lon, radiusMeters, textQueries: QUERIES });

  // ⚠️ `website: null` is Places reporting no website field — which is the definition of the
  // cohort, and also the only signal available. A business with a Facebook page and no site
  // still counts, correctly: they have no site to send a customer to.
  const noWebsite = found.filter((b) => !b.website);
  const withWebsite = found.length - noWebsite.length;

  console.log(`  ${found.length} businesses · ${noWebsite.length} with no website · ${withWebsite} with one`);

  const picked = noWebsite.slice(0, limit);
  // ⚠️ Report the truncation. A silently capped list reads downstream as "this is what the city
  // has", and the hit-rate would then be quoted over a sample nobody knows was cut.
  if (noWebsite.length > limit) {
    console.log(`  ⚠️ capping at ${limit} of ${noWebsite.length} — the rest are NOT in ${out}`);
  }

  const leads = picked.map((b) => ({
    placeId: b.placeId,
    // Kept for the human reading the file; the importer uses placeId.
    _name: b.name,
    _address: b.address ?? null,
  }));

  fs.writeFileSync(out, JSON.stringify(leads, null, 2));
  console.log(`\nWrote ${out} with ${leads.length} no-website leads.`);
  for (const l of leads) console.log(`  · ${l._name}${l._address ? ` — ${l._address}` : ''}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
