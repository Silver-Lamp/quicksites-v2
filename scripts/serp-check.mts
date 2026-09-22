// scripts/serp-check.mts
//
// Run the SERP check and print it as docs/SERP_CHECK_WORKSHEET.md's table, so an automated run
// and a hand-scored one can be read side by side.
//
//   npx tsx --env-file=.env.local scripts/serp-check.mts --set=worksheet --dry
//   npx tsx --env-file=.env.local scripts/serp-check.mts --set=worksheet
//   npx tsx --env-file=.env.local scripts/serp-check.mts --niche=yurt --city=Denver
//
// ⚠️ COSTS MONEY — one provider call per row. --dry still fetches (that is the cost) but writes
// nothing; use it when you want the reading without another row in the table. Nothing here runs
// on a request or a render.

// @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
import ws from 'ws';
(globalThis as any).WebSocket ??= ws;

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const DRY = process.argv.includes('--dry');

const ICON: Record<string, string> = { best: 'BEST', good: 'GOOD', mixed: 'mixed', skip: 'SKIP' };

async function main() {
  const { dataForSeoProvider, serpConfigured } = await import('@/lib/serp/dataforseo');
  const { WORKSHEET_CHECKS, checksFor, LOC } = await import('@/lib/serp/checkSets');
  const { runChecks, readingsOf } = await import('@/lib/serp/runChecks');
  const { tally } = await import('@/lib/serp/classify');
  const { NICHE_CANDIDATES } = await import('@/lib/niches/candidates');

  if (!serpConfigured()) {
    console.error(
      'DataForSEO is not configured. Set DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD.\n' +
        'Nothing was fetched and nothing was charged.',
    );
    process.exit(1);
  }

  let checks = WORKSHEET_CHECKS;
  const niche = arg('niche');
  if (niche) {
    const c = NICHE_CANDIDATES.find((x) => x.key === niche);
    if (!c) { console.error(`No candidate "${niche}".`); process.exit(1); }
    const city = arg('city') ?? 'Austin';
    const loc = (LOC as Record<string, string>)[city.toLowerCase()] ?? `${city},Texas,United States`;
    checks = checksFor(c.key, c.queries, city, loc);
  }
  const limit = Number(arg('limit') ?? checks.length);

  console.log(`${Math.min(limit, checks.length)} searches${DRY ? ' (dry: fetched, not recorded)' : ''}\n`);

  let record;
  if (!DRY) {
    const { supabaseAdmin } = await import('@/lib/supabase/admin');
    record = async (check: any, r: any, raw: unknown) => {
      const { error } = await supabaseAdmin.from('serp_observations').insert({
        niche_key: check.nicheKey, query: r.query, location: r.location,
        provider: dataForSeoProvider.name, pack_size: r.packSize, ad_count: r.adCount,
        ai_overview: r.aiOverview, blocks_above: r.blocksAbove,
        first_organic_domain: r.firstOrganicDomain, first_organic_kind: r.firstOrganicKind,
        first_organic_rank: r.firstOrganicRank, verdict: r.verdict, reason: r.reason, raw,
      });
      if (error) console.warn(`  ! write failed: ${error.message}`);
    };
  }

  const outcomes = await runChecks(checks, {
    provider: dataForSeoProvider,
    limit,
    record,
    onProgress: (done, total) => process.stdout.write(`  ${done}/${total}\r`),
  });

  console.log('\n' + ['#', 'ads', 'pack', 'above', 'first organic', 'verdict'].map((h, i) => h.padEnd([4, 5, 6, 7, 34, 8][i])).join(''));
  console.log('-'.repeat(100));
  outcomes.forEach((o, i) => {
    if (!o.ok) { console.log(`${String(i + 1).padEnd(4)}FAILED  ${o.error}`); return; }
    const r = o.reading;
    console.log(
      String(i + 1).padEnd(4) + String(r.adCount).padEnd(5) + String(r.packSize).padEnd(6) +
      String(r.blocksAbove).padEnd(7) +
      `${r.firstOrganicDomain ?? '—'} (${r.firstOrganicKind})`.slice(0, 33).padEnd(34) +
      ICON[r.verdict],
    );
    console.log(`    ${r.query}  —  ${r.reason}`);
  });

  const t = tally(readingsOf(outcomes));
  console.log(`\n${t.green}/${t.total} green. ${t.recommendation}`);
  const control = outcomes.find((o) => o.ok && o.check.nicheKey === 'towing');
  if (control?.ok) {
    console.log(
      control.reading.verdict === 'skip'
        ? '\nControl OK: towing reads `skip`, as the click data says it must.'
        : `\n⚠️ CONTROL FAILED: towing read "${control.reading.verdict}". The classifier is wrong — do not trust the rest of this run.`,
    );
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
