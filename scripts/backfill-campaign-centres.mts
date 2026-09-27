// scripts/backfill-campaign-centres.mts
//
// Give every geo campaign the real coordinates of its town.
//
//   npx tsx scripts/backfill-campaign-centres.mts [--dry]
//
// ⚠️ WHY THIS EXISTS AND WHY THE MIGRATION WAS NOT ENOUGH. `center_lat`/`center_lon` were NULL
// on all 129 campaigns; migration 20260858 seeded them from the MEDIAN position of the prospects
// filed under each campaign's city, because that data was already local and free. It is not
// good enough, and the check that proved it is worth repeating on any future change here:
//
//   AL Ram Towing's address is `25811 178th Pl SE, Covington, WA`. Against the median-derived
//   centres it came out 4.5 km from "Maple Valley" and 5.9 km from "Covington" — i.e. a
//   Covington business was nearer another town's centre than its own, so the forward-to
//   recommender handed it to the wrong campaign. Geocoded properly: 0.6 km from Covington,
//   4.6 km from Maple Valley.
//
// The medians were wrong because `runSweep` stamps the SEARCHED city onto every business it
// finds (`city: city || null` from the input), so a sweep centred on one town labels businesses
// tens of km away with that town's name, dragging the median across the county.
//
// ⚠️ Geocoding lives in a script, never in a migration: a migration that makes ~75 network calls
// can fail halfway with the ledger already committed, and Nominatim's usage policy asks for
// ~1 request/second, which is not a thing to hold a DB transaction open for.
//
// Cities that do not geocode are LEFT ALONE and reported. The matcher falls back to city-name
// equality for them, which is the old behaviour — degrading is right, inventing a centre is not.
// @ts-ignore — no bundled types; Node 20 has no global WebSocket and the admin client needs
// one at import time (CLAUDE.md §5b, render workers).
import ws from 'ws';
// @ts-ignore
globalThis.WebSocket ??= ws as any;

import { supabaseAdmin } from '@/lib/supabase/admin';
import { getLatLonForCityState } from '@/lib/utils/geocode';

const DRY = process.argv.includes('--dry');

async function main() {
  const { data, error } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, domain, city, region')
    .not('city', 'is', null);
  if (error) throw new Error(error.message);

  const keyOf = (c: { city: string | null; region: string | null }) =>
    `${String(c.city).trim().toLowerCase()}|${String(c.region ?? '').trim().toLowerCase()}`;

  // One geocode per distinct city+region — 129 campaigns are ~75 towns.
  const distinct = new Map<string, { city: string; region: string | null }>();
  for (const c of data ?? []) distinct.set(keyOf(c), { city: c.city as string, region: c.region });

  const coords = new Map<string, { lat: number; lon: number }>();
  const missed: string[] = [];
  for (const [k, v] of distinct) {
    const g = await getLatLonForCityState(v.city, v.region ?? undefined);
    if (g) coords.set(k, g);
    else missed.push(`${v.city}, ${v.region ?? '?'}`);
    await new Promise((r) => setTimeout(r, 1150)); // Nominatim asks for ~1 req/sec.
  }
  console.log(`geocoded ${coords.size} of ${distinct.size} distinct towns`);
  if (missed.length) console.log(`no geocode (left on the city-name fallback): ${missed.join(' · ')}`);

  if (DRY) {
    console.log('--dry: no writes');
    return;
  }

  let updated = 0;
  for (const c of data ?? []) {
    const g = coords.get(keyOf(c));
    if (!g) continue;
    const { error: upErr } = await supabaseAdmin
      .from('geo_industry_campaigns')
      .update({ center_lat: g.lat, center_lon: g.lon })
      .eq('id', c.id);
    if (!upErr) updated++;
  }
  console.log(`updated ${updated} campaigns`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
