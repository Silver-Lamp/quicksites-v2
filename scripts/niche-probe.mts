// scripts/niche-probe.mts
//
// Measure supply density for every candidate niche (lib/niches/candidates.ts) across a spread of
// US metros, score them (lib/niches/score.ts), and print the ranking. Read-only: no DB writes, no
// domains bought, no sites built. It answers one question — "could an organic result win this
// page at all?" — and hands back a shortlist to check by hand.
//
//   npx tsx --env-file=.env.local scripts/niche-probe.mts                  # all candidates, 6 metros
//   npx tsx --env-file=.env.local scripts/niche-probe.mts --metros=10
//   npx tsx --env-file=.env.local scripts/niche-probe.mts --only=yurt,treehouse
//   npx tsx --env-file=.env.local scripts/niche-probe.mts --json=out.json
//
// ⚠️ COSTS MONEY. One Places text search per (candidate × query × metro). The default run is
// ~16 candidates × ~2 queries × 6 metros ≈ 190 calls. Check the printed estimate before a wide run.
//
// ⚠️ Places treats a radius as a BIAS, not a fence (the venue-sweep lesson): results drift into
// the next metro. We fence on the returned coordinates at 1.25× the radius, so a "dome builder"
// 80 km away does not count as local supply — which would make a thin niche look dense and lose
// us exactly the candidates worth finding.

import { writeFileSync } from 'node:fs';

const arg = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

/** A deliberate geographic spread — one region's density is not a national finding. */
const PROBE_METROS: Array<{ city: string; region: string }> = [
  { city: 'Seattle', region: 'WA' },
  { city: 'Austin', region: 'TX' },
  { city: 'Asheville', region: 'NC' },
  { city: 'Denver', region: 'CO' },
  { city: 'Orlando', region: 'FL' },
  { city: 'Portland', region: 'ME' },
  { city: 'Madison', region: 'WI' },
  { city: 'Boise', region: 'ID' },
  { city: 'Phoenix', region: 'AZ' },
  { city: 'Nashville', region: 'TN' },
];

const RADIUS_M = 40_000;
const FENCE = 1.25;

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function main() {
  const { NICHE_CANDIDATES } = await import('@/lib/niches/candidates');
  const { scoreNiche, rankNiches } = await import('@/lib/niches/score');
  type MetroCount = import('@/lib/niches/score').MetroCount;
  const { searchTextNearby } = await import('@/lib/places/searchTextNearby');
  const { getLatLonForCityState } = await import('@/lib/utils/geocode');

  const metroCount = Math.max(1, Math.min(PROBE_METROS.length, Number(arg('metros') ?? 6)));
  const metros = PROBE_METROS.slice(0, metroCount);
  const only = (arg('only') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const candidates = only.length
    ? NICHE_CANDIDATES.filter((c) => only.includes(c.key))
    : NICHE_CANDIDATES;

  const calls = candidates.reduce((s, c) => s + c.queries.length, 0) * metros.length;
  console.log(
    `Probing ${candidates.length} candidates × ${metros.length} metros ≈ ${calls} Places calls.\n`,
  );

  // Geocode once per metro, not once per candidate.
  const points: Array<{ city: string; region: string; lat: number; lon: number }> = [];
  for (const m of metros) {
    const p = await getLatLonForCityState(m.city, m.region);
    if (!p) {
      console.warn(`  ! could not geocode ${m.city}, ${m.region} — skipped`);
      continue;
    }
    points.push({ ...m, lat: p.lat, lon: p.lon });
  }

  const scores = [];
  for (const c of candidates) {
    const counts: MetroCount[] = [];
    for (const p of points) {
      try {
        const found = await searchTextNearby({
          lat: p.lat,
          lon: p.lon,
          radiusMeters: RADIUS_M,
          textQueries: c.queries,
          maxPerQuery: 20,
        });
        // Fence on coordinates — the radius is only a bias.
        const local = found.filter((b) => {
          if (typeof b.lat !== 'number' || typeof b.lon !== 'number') return true; // no coords → keep, don't invent
          return haversineKm({ lat: p.lat, lon: p.lon }, { lat: b.lat, lon: b.lon }) <= (RADIUS_M / 1000) * FENCE;
        });
        counts.push({ city: p.city, region: p.region, count: local.length });
        process.stdout.write(`  ${c.key} ${p.city}: ${local.length}\r`);
      } catch (e) {
        console.warn(`  ! ${c.key} @ ${p.city}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    scores.push(scoreNiche(c, { key: c.key, metros: counts }));
  }

  const ranked = rankNiches(scores);
  console.log('\n');
  console.log(
    ['score', 'per-metro', 'empty', 'density', 'niche'].map((h) => h.padEnd(10)).join('') + 'verdict',
  );
  console.log('-'.repeat(120));
  for (const s of ranked) {
    console.log(
      String(s.score).padEnd(10) +
        String(s.perMetro).padEnd(10) +
        `${s.emptyMetros}/${s.metrosProbed}`.padEnd(10) +
        s.density.padEnd(10) +
        s.label.padEnd(10) +
        '\n' +
        ' '.repeat(10) +
        s.verdict,
    );
  }

  const out = arg('json');
  if (out) {
    writeFileSync(out, JSON.stringify({ metros: points.map((p) => `${p.city}, ${p.region}`), ranked }, null, 2));
    console.log(`\nwrote ${out}`);
  }
  console.log(
    '\nSupply density is a PROXY for local-pack strength — nobody has read a SERP here. A high score earns 10 manual searches, not a domain purchase.',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
