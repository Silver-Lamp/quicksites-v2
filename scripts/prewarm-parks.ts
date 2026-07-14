// scripts/prewarm-parks.ts
//
// Pre-warm the industrial-park registry for one or more metros and print what Google
// Places returned, so you can eyeball data quality BEFORE the lazy resolver feeds these
// parks onto live pitch sites. CHEAP — a few Places Text Search calls per city, no AI.
//
//   npm run parks:prewarm -- "Renton, WA" "Seattle, WA"
//   npm run parks:prewarm -- --force "Renton, WA"     # re-sweep even if already covered
//
// Each arg is a "City, ST" (or just "City"). Needs GOOGLE_PLACES_API_KEY. The registry
// flag is NOT required here — this script sweeps + stores directly (seeding is the point).

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

if (typeof (globalThis as any).WebSocket === 'undefined') {
  try {
    // @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
    const ws = (await import('ws')).default;
    (globalThis as any).WebSocket = ws;
  } catch {
    /* ws not installed — supabase realtime unused here, safe to ignore */
  }
}

// NOTE: @/lib/parks/* is imported dynamically inside main() — a STATIC import would run
// (and instantiate the supabase client via lib/supabase/admin) before dotenv.config()
// above loads the env, throwing "supabaseUrl is required." Same pattern as
// scripts/import-listings-batch.ts.
type ParksLib = {
  seedParksForArea: typeof import('@/lib/parks/seedParks')['seedParksForArea'];
  getParksForArea: typeof import('@/lib/parks/registry')['getParksForArea'];
  hasAreaBeenSwept: typeof import('@/lib/parks/registry')['hasAreaBeenSwept'];
  pickSuite: typeof import('@/lib/parks/suiteScheme')['pickSuite'];
};

function parseCity(arg: string): { city: string; region: string } {
  const [city, region] = arg.split(',').map((s) => s.trim());
  return { city: city ?? arg.trim(), region: region ?? '' };
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const cities = args.filter((a) => a !== '--force');
  if (!cities.length) {
    console.error('Usage: npm run parks:prewarm -- [--force] "City, ST" ["City, ST" …]');
    process.exit(1);
  }

  const { seedParksForArea, getParksForArea, hasAreaBeenSwept, pickSuite }: ParksLib = {
    ...(await import('@/lib/parks/seedParks')),
    ...(await import('@/lib/parks/registry')),
    ...(await import('@/lib/parks/suiteScheme')),
  };

  const printParks = (parks: Awaited<ReturnType<typeof getParksForArea>>) => {
    for (const p of parks) {
      const suite = pickSuite(p.suite_scheme, `${p.place_id}.example.com`);
      console.log(`    • ${p.name}`);
      console.log(`      ${p.street ?? '(no street)'} — Suite ${suite}  [${p.permitted_uses.join('/')}]`);
    }
  };

  for (const arg of cities) {
    const { city, region } = parseCity(arg);
    const already = await hasAreaBeenSwept(city, region);
    if (already && !force) {
      const existing = await getParksForArea(city, region);
      console.log(`\n▸ ${city}${region ? `, ${region}` : ''} — already swept (${existing.length} parks). Use --force to re-sweep.`);
      printParks(existing);
      continue;
    }

    console.log(`\n▸ ${city}${region ? `, ${region}` : ''} — sweeping Places…`);
    const parks = await seedParksForArea(city, region);
    if (!parks.length) {
      console.log('  (0 parks — geocode failed, Places not configured, or genuinely none.)');
      continue;
    }
    console.log(`  ${parks.length} parks stored.`);
    printParks(parks);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
