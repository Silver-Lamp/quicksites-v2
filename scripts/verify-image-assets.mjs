#!/usr/bin/env node
// scripts/verify-image-assets.mjs
//
// Fail the build if a component references a local asset that isn't in public/.
//
// ⚠️ WHY: GRACEFUL DEGRADATION AND SILENT FAILURE ARE THE SAME MECHANISM SEEN FROM TWO SIDES.
//
// A missing image doesn't throw. Next renders alt text, or a broken-icon, or (for a CSS
// backdrop) simply no layer — which is CORRECT behaviour and also a perfect hiding place. A
// typo, a renamed file, or a bad deploy makes the page quietly worse, indefinitely, and
// nothing reports it. The page degrading correctly is necessary but not sufficient: something
// must fail LOUDLY when the asset is missing, or you have built a failure mode that cannot be
// observed.
//
// (Credit: PorchHearth, who wrote the same check on their side after our painterly-404 work
// and pointed out that rule 7's silent degradation had no watcher.)
//
// TWO PROPERTIES THIS CHECK MUST HAVE, both learned the hard way in this repo:
//
//   1. IT MUST FAIL IF IT MATCHES ZERO REFERENCES. A scan that silently matches nothing
//      reports success — which is the exact failure it exists to catch, one level up. This
//      repo has produced that bug twice in one week (a backfill capped at 1000 rows by
//      PostgREST that scanned a third of the fleet and printed ✅; a seeder whose every insert
//      failed on a NOT NULL column while reporting success).
//   2. IT MUST BE PROVEN TO GO RED. A check that has never failed is a check you have no
//      evidence works. `--selftest` injects a missing path and asserts a non-zero exit.
//
// Usage:  node scripts/verify-image-assets.mjs [--selftest]

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['app', 'components'];
const EXTS = /\.(png|jpe?g|webp|svg|mp4|ico|gif|avif)$/i;

// Quoted absolute paths that look like local assets: "/brand/qs-loader.mp4"
const REF = /["'](\/[A-Za-z0-9._/-]+\.(?:png|jpe?g|webp|svg|mp4|ico|gif|avif))["']/g;

/**
 * Tests hold HTML FIXTURES — scraper tests contain `<img src="/img/loaf.png">` describing
 * somebody else's page, not ours. Scanning them produces confident nonsense, which is how a
 * check loses its authority. (Found on this check's first run.)
 */
const SKIP = /(__tests__|\.test\.|\.spec\.|\.stories\.)/;

/**
 * Paths Next serves without a file in public/ — the App Router's file conventions. `/favicon.ico`
 * resolves from app/favicon.ico. Verified against production before adding: it returns 200.
 */
const NEXT_CONVENTIONS = new Set(['/favicon.ico']);

/**
 * Prefixes served by a route at runtime, not from public/. A local-LOOKING path that was never
 * a static asset. (PorchHearth's addition: their run flagged eight `/api/v1/cooks/logos/*.png`
 * paths that were correct, and the pull to make a red check green would have deleted them.)
 */
const RUNTIME_SERVED = [/^\/api\//];

/**
 * Weight ceiling. The bug this catches is a big file rendered tiny — PorchHearth found a
 * 1745 KB avatar drawn at 32 CSS px inside a root-layout widget, i.e. on every page load, and
 * this repo produced the same shape within the hour: eight references repointed at a 1175 KB
 * logo rendered at 48 px.
 *
 * ⚠️ HONEST LIMIT: weight alone is the wrong signal and this check knows it. A 250 KB hero
 * photograph is fine; a 250 KB favicon is not. The real ratio is bytes-vs-RENDERED-SIZE, which
 * a filesystem scan cannot see. So the ceiling is set high enough that only absurdity trips it
 * — it catches the catastrophic case and will happily pass a merely-wasteful one. Treat a pass
 * as "nothing insane," never as "optimised."
 */
const MAX_KB = 600;
const HEAVY_OK = new Set([
  '/brand/qs-loader.mp4', // a video; the ceiling is about images rendered small
]);

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (e === 'node_modules' || e.startsWith('.')) continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(e) && !SKIP.test(p)) out.push(p);
  }
  return out;
}

function collect() {
  const refs = new Map(); // assetPath -> [files]
  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(REF)) {
        const asset = m[1];
        if (!EXTS.test(asset)) continue;
        if (!refs.has(asset)) refs.set(asset, []);
        refs.get(asset).push(relative(ROOT, file));
      }
    }
  }
  return refs;
}

function skip(asset) {
  return NEXT_CONVENTIONS.has(asset) || RUNTIME_SERVED.some((re) => re.test(asset));
}

function missingFrom(refs) {
  const missing = [];
  for (const [asset, files] of refs) {
    if (skip(asset)) continue;
    if (!existsSync(join(ROOT, 'public', asset))) missing.push({ asset, files });
  }
  return missing;
}

/** `ceiling` is a parameter so --selftest can prove the guard fires without a huge fixture. */
function overweightFrom(refs, ceiling = MAX_KB) {
  const heavy = [];
  for (const [asset, files] of refs) {
    if (skip(asset) || HEAVY_OK.has(asset)) continue;
    const p = join(ROOT, 'public', asset);
    if (!existsSync(p)) continue; // reported as missing instead
    const kb = Math.round(statSync(p).size / 1024);
    if (kb > ceiling) heavy.push({ asset, files, kb });
  }
  return heavy;
}

const selftest = process.argv.includes('--selftest');
const refs = collect();

// Property 1: a scan that matches nothing is broken, not clean.
if (refs.size === 0) {
  console.error(
    '✖ verify-image-assets matched ZERO asset references.\n' +
      '  That is not a pass — the scan is broken (moved dirs? changed extensions?).\n' +
      `  Scanned: ${SCAN_DIRS.join(', ')}`,
  );
  process.exit(1);
}

if (selftest) {
  // Property 2: prove it goes red — for EVERY guard, not just the first one.
  //
  // This matters more than it looks. The weight guard was added in a patch that silently
  // failed to wire it into the exit path: `overweightFrom` was defined, never called, and the
  // script printed ✓. A half-proven selftest would have blessed that — the same
  // reports-success-while-doing-nothing failure the whole file exists to prevent, this time
  // inside the check itself.
  const results = [];

  refs.set('/__selftest__/definitely-not-here.png', ['(injected)']);
  results.push([
    'missing asset',
    missingFrom(refs).some((m) => m.asset.startsWith('/__selftest__/')),
  ]);

  // Weigh a real, present file against a deliberately impossible ceiling: if nothing in the
  // repo exceeds MAX_KB, a real-threshold test would pass vacuously and prove nothing.
  const present = [...refs.keys()].find(
    (a) => !skip(a) && existsSync(join(ROOT, 'public', a)) && statSync(join(ROOT, 'public', a)).size > 0,
  );
  const heavyCaught = present
    ? statSync(join(ROOT, 'public', present)).size / 1024 > 0 &&
      overweightFrom(new Map([[present, ['(injected)']]]), 0).length === 1
    : false;
  results.push(['overweight asset', heavyCaught]);

  for (const [name, ok] of results) console.log(`${ok ? '✓' : '✖'} selftest: detects ${name}`);
  process.exit(results.every(([, ok]) => ok) ? 0 : 1);
}

let failed = false;

const missing = missingFrom(refs);
if (missing.length) {
  failed = true;
  console.error(`✖ ${missing.length} referenced asset(s) missing from public/:\n`);
  for (const { asset, files } of missing) {
    console.error(`  ${asset}`);
    for (const f of files) console.error(`      ← ${f}`);
  }
  console.error('\nAdd the file to public/, fix the path, or delete the dead reference.');
}

const heavy = overweightFrom(refs);
if (heavy.length) {
  failed = true;
  console.error(`\n✖ ${heavy.length} referenced asset(s) over ${MAX_KB} KB:\n`);
  for (const { asset, files, kb } of heavy) {
    console.error(`  ${asset} (${kb} KB)`);
    for (const f of files) console.error(`      ← ${f}`);
  }
  console.error(
    '\nResize/re-encode it, or add it to HEAVY_OK with a reason. Check what size it actually\n' +
      'RENDERS at — the bug this catches is a huge file drawn small, on every page load.',
  );
}

if (failed) process.exit(1);
console.log(`✓ ${refs.size} local asset reference(s) resolve, none over ${MAX_KB} KB.`);
