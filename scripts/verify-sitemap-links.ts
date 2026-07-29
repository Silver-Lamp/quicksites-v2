// scripts/verify-sitemap-links.ts
//
// Fetch every link in the human sitemap and fail on anything that isn't 200.
//
// Reference implementation for rule 2 of crosstalk/contracts/not-found-sitemap.md:
// "curl every link before you add it — AND re-check them on a cadence."
//
// WHY A CADENCE AND NOT A ONE-TIME CHECK. A sitemap is a CLAIM ABOUT OTHER PAGES, so it
// decays without anyone touching it: a route gets renamed, a flag flips a page off, a surface
// slips behind auth. Every link in lib/site/siteMap.ts returned 200 the day it was written,
// which is exactly as durable as any other point-in-time verification. The failure is silent
// and lands on the one visitor least able to absorb it — someone already lost, following our
// own map to a second dead end.
//
// This is a SCRIPT, not a unit test, deliberately: the check is a network call against
// production, and network calls in a unit suite are flaky, slow, and get muted the first time
// they go red for an unrelated reason. Run it from CI on a schedule, or by hand.
//
//   npx tsx scripts/verify-sitemap-links.ts                      # against production
//   npx tsx scripts/verify-sitemap-links.ts --base http://localhost:3000
//
// Exits 1 if any link is unreachable, so a scheduled job fails loudly.
import { SITE_MAP } from '../lib/site/siteMap';

const baseIdx = process.argv.indexOf('--base');
const BASE = (baseIdx >= 0 ? process.argv[baseIdx + 1] : '') || 'https://www.quicksites.ai';
const TIMEOUT_MS = 20_000;

type Result = { href: string; label: string; status: number | string; ok: boolean };

async function check(href: string, label: string): Promise<Result> {
  const url = `${BASE}${href}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    // GET, not HEAD: several framework routes answer HEAD differently (or not at all), and a
    // HEAD-only check would pass on a page that 500s for real visitors.
    const res = await fetch(url, { redirect: 'follow', signal: ctl.signal });
    return { href, label, status: res.status, ok: res.status === 200 };
  } catch (e: any) {
    return { href, label, status: e?.name === 'AbortError' ? 'timeout' : 'error', ok: false };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const links = SITE_MAP.flatMap((g) => g.links.map((l) => ({ href: l.href, label: l.label })));
  console.log(`Checking ${links.length} sitemap links against ${BASE}\n`);

  const results: Result[] = [];
  // Small concurrency: enough to be quick, low enough not to look like a burst to our own
  // rate limiters.
  const CONCURRENCY = 5;
  for (let i = 0; i < links.length; i += CONCURRENCY) {
    const batch = links.slice(i, i + CONCURRENCY);
    results.push(...(await Promise.all(batch.map((l) => check(l.href, l.label)))));
  }

  for (const r of results.sort((a, b) => a.href.localeCompare(b.href))) {
    console.log(`  ${r.ok ? '✓' : '✗'} ${String(r.status).padEnd(7)} ${r.href.padEnd(30)} ${r.label}`);
  }

  const broken = results.filter((r) => !r.ok);
  console.log(`\n${results.length - broken.length}/${results.length} reachable`);

  if (broken.length) {
    console.error(`\n✗ ${broken.length} link(s) in the sitemap are broken:`);
    for (const b of broken) console.error(`    ${b.href} → ${b.status}`);
    console.error('\nA map that points at dead ends loses an already-lost visitor.');
    console.error('Fix the route or remove the entry from lib/site/siteMap.ts.');
    process.exit(1);
  }
  console.log('✓ every link in the sitemap resolves.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
