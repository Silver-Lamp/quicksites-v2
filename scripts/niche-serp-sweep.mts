// scripts/niche-serp-sweep.mts
//
// SERP-check every candidate niche across a spread of cities and rank them. This is the DIRECT
// measurement — it replaces gating on the supply-density probe.
//
// ⚠️ WHY NOT PROBE FIRST ANY MORE. The probe was a cheap proxy for local-pack strength, worth
// having while a SERP read was unvalidated and we did not want to buy on it. The classifier has
// since been checked against a person on four rows (four matches, identical pack counts), and a
// SERP check costs about $0.002. The proxy also misled twice: `earth_natural` read 16.2 per metro
// because "natural building contractor" matches every general contractor, and the Places sweep
// missed the builder ranking FIRST for its own query. A proxy wrong in both directions is not
// worth gating on when the true measure is nearly free.
//
//   npx tsx --env-file=.env.local scripts/niche-serp-sweep.mts --dry
//   npx tsx --env-file=.env.local scripts/niche-serp-sweep.mts --cities=Austin,Denver --reads=5 --apply
//
// ⚠️ COSTS MONEY: one call per (niche × query × city × READ). It prints the count and the estimate
// before spending and refuses to run without --apply.
//
// ⚠️ `--reads` IS THE SETTING THAT MAKES THE OUTPUT MEAN ANYTHING, AND ITS DEFAULT IS 1 ONLY SO
// THAT A CHEAP EXPLORATORY RUN STAYS CHEAP. One read does NOT measure a query — Google serves more
// than one layout for the same search, so a single read samples a layout. Two single-read sweeps an
// hour apart moved the treehouse control (a live cohort) from 6/8 green to 1/3. Score with
// `scripts/serp-rates.mts`, which reads every row this has ever written and costs nothing; at K=5
// only a UNANIMOUS query resolves, and that is the honest price rather than a defect.

// @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
import ws from 'ws';
(globalThis as any).WebSocket ??= ws;

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const APPLY = process.argv.includes('--apply');
const READS = Math.max(1, Number(arg('reads') ?? 1));
const PER_CALL_USD = 0.002; // approximate; see docs/NICHE_DISCOVERY.md

async function main() {
  const { NICHE_CANDIDATES } = await import('@/lib/niches/candidates');
  const { locationFor } = await import('@/lib/serp/checkSets');
  const { dataForSeoProvider } = await import('@/lib/serp/dataforseo');
  const { readSerp, isGreen, isFeatureless } = await import('@/lib/serp/classify');
  const { supabaseAdmin } = await import('@/lib/supabase/admin');

  const cities = (arg('cities') ?? 'Austin,Denver')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  const only = (arg('only') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // The controls are already measured and would only spend money re-proving themselves.
  const candidates = NICHE_CANDIDATES.filter(
    (c) => !['towing', 'deck_builder'].includes(c.key) && (!only.length || only.includes(c.key))
  );

  const calls = candidates.reduce((s, c) => s + c.queries.length, 0) * cities.length * READS;
  console.log(
    `${candidates.length} niches x ${cities.length} cities x ${READS} read(s) = ${calls} checks, ` +
      `about $${(calls * PER_CALL_USD).toFixed(2)}.` +
      (APPLY ? '' : ' Dry run — nothing fetched, nothing charged. Add --apply.')
  );
  if (READS === 1) {
    console.log(
      '⚠️ --reads=1 samples one of the layouts Google serves for each query; it does not measure it.\n' +
        '   Fine for exploring. Do not rank niches on it — pass --reads=5 for a rate with an interval.'
    );
  }
  if (!APPLY) return;

  type Row = {
    key: string;
    label: string;
    green: number;
    total: number;
    failed: number;
    notes: string[];
  };
  const rows: Row[] = [];
  // ⚠️ MEASURE OUR OWN REPEATABILITY, DON'T ASSUME IT. A SERP is not a constant, so re-checking the
  // same query is a free read on how much of a niche's score is signal. Derived every run rather
  // than written down once, because the answer changes with the classifier and with Google.
  const repeat = { seen: 0, changed: 0, crossedGreen: 0, examples: [] as string[] };
  const confirmed = { corrected: 0, agreed: 0, unresolved: 0 };

  for (const c of candidates) {
    const row: Row = { key: c.key, label: c.label, green: 0, total: 0, failed: 0, notes: [] };
    for (const city of cities) {
      const loc = locationFor(city);
      for (const q of c.queries) {
        const query = `${q} ${city.toLowerCase()}`;
        for (let readNo = 0; readNo < READS; readNo++) {
          // ⚠️ RETRY, BECAUSE THE FAILURES ARE NOT RANDOM ACROSS NICHES. The first sweep lost about
          // 30% of checks to DataForSEO's transient "Internal SE Server Error", and the losses
          // clustered: domes came back 0% green on a single surviving check — a niche we have LIVE
          // and working. A percentage computed over one sample looks exactly like a percentage
          // computed over four, so a lossy run does not read as unreliable, it reads as a finding.
          let snap: Awaited<ReturnType<typeof dataForSeoProvider.fetchSerp>> | null = null;
          for (let attempt = 1; attempt <= 3 && !snap; attempt++) {
            try {
              snap = await dataForSeoProvider.fetchSerp(query, loc);
            } catch {
              if (attempt < 3) await new Promise((res) => setTimeout(res, 2000 * attempt));
            }
          }
          try {
            if (!snap) throw new Error('failed after 3 attempts');
            let used = snap;
            let r = readSerp(used);

            // ⚠️ CONFIRM A FEATURELESS GREEN, BECAUSE TRUNCATION SCORES AS OPPORTUNITY. See
            // `isFeatureless`. In the first full sweep 4 of 108 readings were featureless and ALL
            // FOUR were green; two were provably short responses (half the `se_results_count` and
            // whole feature classes missing from `item_types`). One extra call on ~4% of rows is
            // about $0.008 per sweep, and it only ever moves a verdict toward "skip".
            if (isFeatureless(r) && isGreen(r.verdict)) {
              let second: typeof used | null = null;
              for (let attempt = 1; attempt <= 2 && !second; attempt++) {
                try {
                  second = await dataForSeoProvider.fetchSerp(query, loc);
                } catch {
                  if (attempt < 2) await new Promise((res) => setTimeout(res, 2000));
                }
              }
              if (second) {
                const r2 = readSerp(second);
                // A feature SEEN is real; a feature missing may be truncation. So the read that
                // found something wins, whichever order they arrived in.
                if (!isFeatureless(r2)) {
                  r = r2;
                  used = second;
                  confirmed.corrected++;
                } else {
                  confirmed.agreed++;
                }
              } else {
                confirmed.unresolved++;
              }
            }

            const { data: prior } = await supabaseAdmin
              .from('serp_observations')
              .select('verdict')
              .eq('niche_key', c.key)
              .eq('query', r.query)
              .eq('location', r.location)
              .order('checked_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (prior?.verdict) {
              repeat.seen++;
              if (prior.verdict !== r.verdict) {
                repeat.changed++;
                if (isGreen(prior.verdict) !== isGreen(r.verdict)) {
                  repeat.crossedGreen++;
                  repeat.examples.push(`${prior.verdict} -> ${r.verdict} on "${query}"`);
                }
              }
            }
            await supabaseAdmin.from('serp_observations').insert({
              niche_key: c.key,
              query: r.query,
              location: r.location,
              provider: 'dataforseo',
              pack_size: r.packSize,
              ad_count: r.adCount,
              ai_overview: r.aiOverview,
              blocks_above: r.blocksAbove,
              first_organic_domain: r.firstOrganicDomain,
              first_organic_kind: r.firstOrganicKind,
              first_organic_rank: r.firstOrganicRank,
              verdict: r.verdict,
              reason: r.reason,
              raw: used.raw,
            });
            row.total++;
            if (isGreen(r.verdict)) row.green++;
            if (r.firstOrganicKind === 'forum') row.notes.push(`forum #1 on "${query}"`);
            process.stdout.write(
              `  ${c.key} ${city}: ${r.verdict} (pack ${r.packSize})            \r`
            );
          } catch (e) {
            row.failed++;
          }
        }
      }
    }
    rows.push(row);
  }

  rows.sort((a, b) => (b.total ? b.green / b.total : 0) - (a.total ? a.green / a.total : 0));
  console.log('\n');
  console.log('green  checks  niche');
  console.log('-'.repeat(78));
  for (const r of rows) {
    const pct = r.total ? Math.round((100 * r.green) / r.total) : 0;
    const flag = r.total >= 2 && pct >= 70 ? '  <= worth a hand check' : '';
    console.log(
      `${String(r.green).padStart(2)}/${String(r.total).padEnd(3)} ${String(pct).padStart(3)}%   ${r.label}${r.failed ? ` (${r.failed} failed)` : ''}${flag}`
    );
    for (const n of [...new Set(r.notes)]) console.log(`           ${n}`);
  }
  const thin = rows.filter((r) => r.total < 3);
  if (thin.length) {
    console.log(
      `\n⚠️ ${thin.length} niche(s) landed fewer than 3 checks and their percentages mean nothing:` +
        `\n   ${thin.map((r) => `${r.label} (${r.total})`).join(', ')}` +
        `\n   Re-run those with --only=<keys> before reading anything into them.`
    );
  }
  const confirmTotal = confirmed.corrected + confirmed.agreed + confirmed.unresolved;
  if (confirmTotal) {
    console.log(
      `\n🔎 ${confirmTotal} reading(s) showed NO page features at all and scored green, so each got a` +
        `\n   second read. ${confirmed.corrected} turned out to be a short response and were replaced,` +
        ` ${confirmed.agreed} confirmed,\n   ${confirmed.unresolved} could not be re-fetched (kept as read — treat as unconfirmed).`
    );
  }
  if (READS > 1) {
    console.log(
      `\n📐 ${READS} reads per query — the green counts above treat each read as a check, which is` +
        `\n   NOT the right unit. Score this run as a rate with an interval (spends nothing):` +
        `\n     npx tsx --env-file=.env.local scripts/serp-rates.mts`
    );
  }
  if (READS === 1 && repeat.seen) {
    console.log(
      `\n🔁 ${repeat.seen} check(s) had been run before. ${repeat.changed} read differently this time,` +
        ` ${repeat.crossedGreen} of them\n   across the green/skip line — the only difference that changes a decision.`
    );
    for (const e of [...new Set(repeat.examples)].slice(0, 6)) console.log(`   ${e}`);
    if (repeat.crossedGreen) {
      console.log(
        `   ⚠️ So a gap of ${repeat.crossedGreen} check(s) between two niches is inside this run's own noise.` +
          `\n      Rank on the gaps that are wider than that, not on the ordering.`
      );
    }
  }
  console.log(
    '\n⚠️ A high score earns a HAND CHECK of one or two rows, not a domain purchase. The classifier' +
      '\n   agrees with a person on four rows so far; that is calibration, not proof it cannot be wrong.'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
