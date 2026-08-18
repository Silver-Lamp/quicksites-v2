// scripts/content-probe.ts
//
// Runs lib/probe/targets.ts against PRODUCTION and reports what actually came back.
//
// Two instruments, because one is not enough and each misses what the other sees:
//   1. fetch  — content assertions on the served HTML, and byte-sniffing for images.
//   2. browser — computed `color-scheme` under an emulated OS theme. NOT a screenshot: pixel
//      comparison is where cost and flakiness live, and it is not needed. The bug this catches
//      (#837) was a native checkbox rendering dark on a light page because form controls obey
//      `color-scheme`, which no semantic token touches — a computed-style read settles it exactly.
//
// ⚠️ Runs on a SCHEDULE, not per-PR. A pull request cannot change what production is serving, so
// per-PR runs would be pure noise, and a check that is often red gets ignored — the failure this
// exists to prevent.
//
//   npx tsx scripts/content-probe.ts            # all checks
//   npx tsx scripts/content-probe.ts --only tenant-site-ssr
import { CHECKS } from '../lib/probe/targets';
import { evaluateHtml, evaluateImage } from '../lib/probe/checks';
import type { Check, Theme } from '../lib/probe/checks';

type Result = { check: Check; conditions: string[]; failures: string[] };

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const checks = only ? CHECKS.filter((c) => c.name === only) : CHECKS;

async function runFetch(check: Check): Promise<string[]> {
  const res = await fetch(check.url, { redirect: 'follow', headers: { 'user-agent': 'quicksites-content-probe' } });
  if (check.expectImage) {
    const buf = new Uint8Array(await res.arrayBuffer());
    return evaluateImage(check, buf, res.headers.get('content-type') ?? '');
  }
  return evaluateHtml(check, await res.text());
}

/** Only loaded when a check actually declares themes, so the common path needs no browser. */
async function runThemes(check: Check, themes: Theme[]): Promise<string[]> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const fails: string[] = [];
  try {
    for (const theme of themes) {
      const page = await browser.newPage({ colorScheme: theme });
      await page.goto(check.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      // What native controls actually obey. `data-theme` fixes what WE draw; this fixes what the
      // BROWSER draws, and only the second one is visible to a checkbox.
      const sel = check.colorSchemeSelector ?? '[data-theme]';
      const resolved = await page.evaluate((s) => {
        const el = document.querySelector(s);
        return el ? getComputedStyle(el).colorScheme : 'NO-SUCH-ELEMENT';
      }, sel);
      if (resolved === 'NO-SUCH-ELEMENT') {
        // Not a pass. The subject of the assertion is missing, which means the page changed shape
        // and the check is now measuring nothing — report that rather than silently going green.
        fails.push(`under OS theme "${theme}": no element matched ${sel} — the check has lost its subject`);
        await page.close();
        continue;
      }
      if (check.expectColorScheme && !String(resolved).includes(check.expectColorScheme)) {
        fails.push(`under OS theme "${theme}": ${sel} resolved color-scheme "${resolved}", expected "${check.expectColorScheme}" — native controls will follow the visitor's OS, not the page`);
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
  return fails;
}

const results: Result[] = [];
for (const check of checks) {
  const conditions = ['fetch'];
  let failures: string[] = [];
  try {
    failures = await runFetch(check);
    if (check.themes?.length) {
      conditions.push(...check.themes.map((t) => `os-theme:${t}`));
      failures = failures.concat(await runThemes(check, check.themes));
    }
  } catch (err: any) {
    failures = [`probe error: ${err?.message ?? String(err)}`];
  }
  results.push({ check, conditions, failures });
}

let red = 0;
for (const { check, conditions, failures } of results) {
  // Always print the conditions. A check that does not say how far it reached invites the reader
  // to assume it reached everywhere — which is how a true result becomes a false all-clear.
  const head = `${failures.length ? 'FAIL' : 'ok  '}  ${check.name}  [${conditions.join(', ')}]`;
  console.log(head);
  if (failures.length) {
    red++;
    console.log(`      ${check.url}`);
    console.log(`      why this check exists: ${check.because}`);
    for (const f of failures) console.log(`      → ${f}`);
  }
}
console.log(`\n${results.length - red}/${results.length} passed`);
process.exit(red > 0 ? 1 : 0);
