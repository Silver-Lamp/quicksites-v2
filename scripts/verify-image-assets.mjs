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

function missingFrom(refs) {
  const missing = [];
  for (const [asset, files] of refs) {
    if (NEXT_CONVENTIONS.has(asset)) continue;
    if (!existsSync(join(ROOT, 'public', asset))) missing.push({ asset, files });
  }
  return missing;
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
  // Property 2: prove it goes red. Inject a reference that cannot resolve.
  refs.set('/__selftest__/definitely-not-here.png', ['(injected by --selftest)']);
  const found = missingFrom(refs);
  const caught = found.some((m) => m.asset.startsWith('/__selftest__/'));
  console.log(
    caught
      ? '✓ selftest: the check detects a missing asset (it goes red when it should).'
      : '✖ selftest: the check FAILED to detect an injected missing asset.',
  );
  process.exit(caught ? 0 : 1);
}

const missing = missingFrom(refs);
if (missing.length) {
  console.error(`✖ ${missing.length} referenced asset(s) missing from public/:\n`);
  for (const { asset, files } of missing) {
    console.error(`  ${asset}`);
    for (const f of files) console.error(`      ← ${f}`);
  }
  console.error('\nAdd the file to public/, fix the path, or delete the dead reference.');
  process.exit(1);
}

console.log(`✓ ${refs.size} local asset reference(s) all resolve in public/.`);
