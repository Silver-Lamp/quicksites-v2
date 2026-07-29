#!/usr/bin/env node
// scripts/verify-image-assets.mjs
//
// Fail the build if a component references a local asset that isn't in public/, or references
// one so large it can only be a mistake.
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
// The mirror failure is an asset that IS present and absurd — PorchHearth found a 1745 KB
// avatar rendered at 32 CSS px inside a root-layout widget (1.7 MB on every page load to draw
// a 32-pixel circle), and this repo produced the same shape within the hour: eight references
// repointed at a 1175 KB logo rendered at 48 px. Same instrument, opposite failure, and neither
// is visible from inside the app.
//
// (Both halves came from PorchHearth, who wrote this check on their side after our
// painterly-404 work and pointed out that rule 7's silent degradation had no watcher.)
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// FOUR PROPERTIES THIS CHECK MUST HAVE. Every one was learned by violating it.
//
//   1. FAIL IF IT MATCHES ZERO REFERENCES. A scan that silently matches nothing reports
//      success — the exact failure it exists to catch, one level up. This repo produced that
//      bug twice in a week (a backfill capped at 1000 rows by PostgREST that scanned a third
//      of the fleet and printed ✅; a seeder whose every insert failed a NOT NULL constraint
//      while reporting success).
//
//   2. BE PROVEN TO GO RED. A check that has never failed is a check you have no evidence
//      works. PorchHearth's version: an unproven guard is a guard you don't have, EVEN WHEN IT
//      HAPPENS TO WORK — theirs fired correctly but had only ever been asserted in a PR
//      description, which is the same confidence a dead guard has.
//
//   3. PROVE EVERY GUARD, AGAINST A CONDITION THAT CAN ACTUALLY OCCUR. A selftest covering one
//      guard blesses the rest. And proving the weight guard at its REAL 600 KB ceiling, when
//      nothing in the repo exceeds it, passes vacuously — proving nothing. Each guard needs a
//      real case on BOTH sides: something that must trip it, and something that must not.
//
//   4. ⚠️ EXERCISE THE REAL EXIT PATH, NOT THE GUARD FUNCTIONS. This is the sharp one, and the
//      first version of this selftest got it wrong. The weight guard originally shipped DEAD:
//      `overweightFrom()` was defined, correct, and never wired into the exit path, and the
//      script printed a green checkmark. A selftest that calls the guard functions directly
//      passes happily in that state — it proves the guard COMPUTES, not that anything CONSULTS
//      it. So --selftest spawns THIS FILE as a subprocess against fixture directories and
//      asserts the process exit code. Unwire a guard and the corresponding fixture returns 0
//      and the selftest fails.
//
//      That matters more than it sounds: a broken check doesn't merely miss its target, it
//      actively certifies that everything is fine. Enforce, don't hope — including on the
//      enforcement.
// ─────────────────────────────────────────────────────────────────────────────────────────
//
// Usage:
//   node scripts/verify-image-assets.mjs
//   node scripts/verify-image-assets.mjs --selftest
//   node scripts/verify-image-assets.mjs --scan <dirs,csv> --public <dir>   # used by selftest

import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const ROOT = process.cwd();

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

const SCAN_DIRS = (argValue('--scan') || 'app,components').split(',');
const PUBLIC_ROOT = argValue('--public') || join(ROOT, 'public');

const EXTS = /\.(png|jpe?g|webp|svg|mp4|ico|gif|avif)$/i;

// Quoted absolute paths that look like local assets: "/brand/qs-loader.mp4"
const REF = /["'](\/[A-Za-z0-9._/-]+\.(?:png|jpe?g|webp|svg|mp4|ico|gif|avif))["']/g;

/**
 * Tests hold HTML FIXTURES — scraper tests contain `<img src="/img/loaf.png">` describing
 * somebody else's page, not ours. Scanning them produces confident nonsense, which is how a
 * check loses its authority. (Two false positives on this check's first run.)
 */
const SKIP = /(__tests__|\.test\.|\.spec\.|\.stories\.)/;

/**
 * Paths Next serves without a file in public/ — the App Router's file conventions.
 * `/favicon.ico` resolves from app/favicon.ico. Verified against production: it returns 200.
 */
const NEXT_CONVENTIONS = new Set(['/favicon.ico']);

/**
 * Prefixes served by a route at runtime, not from public/ — a local-LOOKING path that was
 * never a static asset. (PorchHearth's addition: their run flagged eight
 * `/api/v1/cooks/logos/*.png` paths that were CORRECT, and the pull to make a red check green
 * would have deleted working code.)
 */
const RUNTIME_SERVED = [/^\/api\//];

/**
 * Weight ceiling.
 *
 * ⚠️ HONEST LIMIT: weight alone is the wrong signal and this check knows it. A 250 KB hero
 * photograph is fine; a 250 KB favicon is not. The real ratio is bytes-vs-RENDERED-SIZE, which
 * a filesystem scan cannot see. The ceiling is set high enough that only absurdity trips it, so
 * treat a pass as "nothing insane," never as "optimised."
 */
const MAX_KB = 600;
const HEAVY_OK = new Set([
  '/brand/qs-loader.mp4', // a video; this ceiling is about images rendered small
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
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(e) && !SKIP.test(p)) out.push(p);
  }
  return out;
}

function collect() {
  const refs = new Map(); // assetPath -> [files]
  for (const dir of SCAN_DIRS) {
    const abs = dir.startsWith('/') ? dir : join(ROOT, dir);
    for (const file of walk(abs)) {
      for (const m of readFileSync(file, 'utf8').matchAll(REF)) {
        const asset = m[1];
        if (!EXTS.test(asset)) continue;
        if (!refs.has(asset)) refs.set(asset, []);
        refs.get(asset).push(relative(ROOT, file));
      }
    }
  }
  return refs;
}

const skip = (a) => NEXT_CONVENTIONS.has(a) || RUNTIME_SERVED.some((re) => re.test(a));

function missingFrom(refs) {
  const out = [];
  for (const [asset, files] of refs) {
    if (skip(asset)) continue;
    if (!existsSync(join(PUBLIC_ROOT, asset))) out.push({ asset, files });
  }
  return out;
}

function overweightFrom(refs) {
  const out = [];
  for (const [asset, files] of refs) {
    if (skip(asset) || HEAVY_OK.has(asset)) continue;
    const p = join(PUBLIC_ROOT, asset);
    if (!existsSync(p)) continue; // reported as missing instead
    const kb = Math.round(statSync(p).size / 1024);
    if (kb > MAX_KB) out.push({ asset, files, kb });
  }
  return out;
}

// ── selftest ────────────────────────────────────────────────────────────────────────────────
// Property 4: spawn the REAL script against fixtures and assert its EXIT CODE, so an unwired
// guard fails here instead of being blessed.

function runFixture({ source, assets }) {
  const dir = join(tmpdir(), `qs-asset-selftest-${Math.abs(hash(source + JSON.stringify(assets)))}`);
  rmSync(dir, { recursive: true, force: true });
  const src = join(dir, 'src');
  const pub = join(dir, 'public');
  mkdirSync(src, { recursive: true });
  mkdirSync(pub, { recursive: true });
  writeFileSync(join(src, 'Fixture.tsx'), source);
  for (const [name, bytes] of Object.entries(assets)) {
    const p = join(pub, name);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, Buffer.alloc(bytes, 0));
  }
  const r = spawnSync(process.execPath, [SELF, '--scan', src, '--public', pub], {
    encoding: 'utf8',
  });
  rmSync(dir, { recursive: true, force: true });
  return r.status;
}

// Deterministic temp-dir naming; Math.random would leave litter on a crash.
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function selftest() {
  const KB = 1024;
  const cases = [
    {
      name: 'missing asset trips the check',
      expect: 1,
      source: `export default () => <img src="/nope/missing.png" />;`,
      assets: {},
    },
    {
      name: 'oversized asset trips the check',
      expect: 1,
      source: `export default () => <img src="/huge.png" />;`,
      assets: { 'huge.png': (MAX_KB + 50) * KB },
    },
    {
      name: 'zero references trips the check',
      expect: 1,
      source: `export default () => <div>no assets here</div>;`,
      assets: {},
    },
    {
      // The other side of property 3: a guard that fires on everything is as useless as one
      // that fires on nothing. A healthy fixture MUST pass.
      name: 'a present, reasonably-sized asset passes',
      expect: 0,
      source: `export default () => <img src="/fine.png" />;`,
      assets: { 'fine.png': 12 * KB },
    },
  ];

  let ok = true;
  for (const c of cases) {
    const status = runFixture(c);
    const pass = status === c.expect;
    if (!pass) ok = false;
    console.log(`${pass ? '✓' : '✖'} selftest: ${c.name}` + (pass ? '' : ` (exit ${status}, expected ${c.expect})`));
  }
  if (!ok) {
    console.error(
      '\nA selftest case failed. Either a guard is not wired into the exit path (the failure\n' +
        'this selftest exists to catch), or the check now rejects something healthy.',
    );
  }
  return ok;
}

// ── main ────────────────────────────────────────────────────────────────────────────────────

if (process.argv.includes('--selftest')) {
  process.exit(selftest() ? 0 : 1);
}

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
