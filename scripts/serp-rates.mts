// scripts/serp-rates.mts
//
// Score every niche as a RATE from the readings already in `serp_observations`. Spends nothing —
// every read the sweeps have ever taken is already a row, so this re-reads history rather than
// buying it again. Run it before `niche-serp-sweep --apply` to see which queries actually need
// more reads, and after, to see what the spend bought.
//
//   npx tsx --env-file=.env.local scripts/serp-rates.mts
//   npx tsx --env-file=.env.local scripts/serp-rates.mts --days=3 --min-reads=5
//
// ⚠️ Why a rate and not a green count: see the header of lib/serp/rate.ts. Short version — Google
// serves more than one layout for the same query, so one read samples a layout instead of
// measuring the query, and two sweeps an hour apart moved the live-cohort control from 6/8 to 1/3.

// @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
import ws from 'ws';
(globalThis as any).WebSocket ??= ws;

import type { QueryRate, RateInput } from '@/lib/serp/rate';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];

async function main() {
  const { NICHE_CANDIDATES } = await import('@/lib/niches/candidates');
  const { rateNiche, rateQuery, readsToResolve } = await import('@/lib/serp/rate');
  const { packFreeClaimIsVerifiable } = await import('@/lib/serp/aiOverview');
  const { supabaseAdmin } = await import('@/lib/supabase/admin');

  const days = Number(arg('days') ?? 7);
  const minReads = Number(arg('min-reads') ?? 5);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('serp_observations')
    .select('niche_key,query,location,pack_size,ai_overview,verdict,checked_at,raw')
    .gte('checked_at', since)
    .not('niche_key', 'is', null)
    .limit(20000);
  if (error) throw error;

  const byQuery = new Map<
    string,
    { key: string; query: string; location: string; reads: RateInput[] }
  >();
  for (const r of data ?? []) {
    const id = `${r.niche_key}|${r.query}|${r.location}`;
    const bucket = byQuery.get(id) ?? {
      key: String(r.niche_key),
      query: String(r.query),
      location: String(r.location),
      reads: [],
    };
    bucket.reads.push({
      packSize: Number(r.pack_size ?? 0),
      aiOverview: Boolean(r.ai_overview),
      verdict: r.verdict as RateInput['verdict'],
      // Computed from the raw we already store, so every historical reading is re-judged for free.
      packFreeVerifiable: packFreeClaimIsVerifiable({
        packSize: Number(r.pack_size ?? 0),
        raw: (r as any).raw,
      }),
    });
    byQuery.set(id, bucket);
  }

  const rates = [...byQuery.values()].map((b) => ({
    key: b.key,
    rate: rateQuery(b.query, b.location, b.reads),
  }));

  // ⚠️ THE GUARD ON THIS WHOLE APPROACH. If no query anywhere ever varied between reads, the reads
  // are not independent — a cached provider response would produce exactly that, and it yields a
  // tight interval and total confidence, which is this tool's own failure mode restored one level
  // up. Checked against every query with more than one read, not a sample.
  const repeated = rates.filter((r) => r.rate.reads > 1);
  const varied = repeated.filter((r) => r.rate.varied);
  if (repeated.length >= 5 && varied.length === 0) {
    console.log(
      `\n⛔ ${repeated.length} queries were read more than once and NOT ONE varied.\n` +
        `   Independent reads of a live SERP do vary — this looks like a cached response, and a\n` +
        `   cached read makes every interval below far too narrow. Stop and check the provider\n` +
        `   before believing any number in this report.\n`
    );
  }

  const byNiche = new Map<string, QueryRate[]>();
  for (const { key, rate } of rates) byNiche.set(key, [...(byNiche.get(key) ?? []), rate]);

  const label = (k: string) => NICHE_CANDIDATES.find((c) => c.key === k)?.label ?? k;
  const scored = [...byNiche.entries()]
    .map(([key, qs]) => ({ niche: rateNiche(key, qs), queries: qs }))
    .sort((a, b) => b.niche.packFreeRate - a.niche.packFreeRate);

  const ORDER = { winnable: 0, contested: 1, lost: 2 } as const;
  scored.sort(
    (a, b) =>
      ORDER[a.niche.verdict] - ORDER[b.niche.verdict] || b.niche.packFreeRate - a.niche.packFreeRate
  );

  console.log(
    `\nReadings from the last ${days} day(s). A rate, not a score — read the interval.\n`
  );
  console.log('pack-free  reads  verdict     niche');
  console.log('-'.repeat(84));
  for (const { niche, queries } of scored) {
    const pct = `${Math.round(niche.packFreeRate * 100)}%`.padStart(5);
    console.log(
      `   ${pct}  ${String(niche.reads).padStart(5)}  ${niche.verdict.padEnd(10)}  ${label(niche.key)}` +
        (niche.contested ? `  (${niche.contested}/${niche.queries} queries unresolved)` : '')
    );
    for (const q of queries) {
      const more = readsToResolve(q);
      const need =
        q.verdict !== 'contested'
          ? ''
          : more === null
            ? '  — a genuine coin flip; more reads will not settle it'
            : `  — needs ~${more} more read(s)`;
      console.log(
        `             ${String(q.reads).padStart(2)}x  ${q.verdict.padEnd(10)}  ` +
          `${Math.round(q.packFreeRate * 100)}% [${Math.round(q.lo * 100)}–${Math.round(q.hi * 100)}]  ` +
          `"${q.query}" @ ${q.location.split(',')[0]}${need}`
      );
    }
  }

  const thin = rates.filter((r) => r.rate.reads < minReads);
  if (thin.length) {
    console.log(
      `\n⚠️ ${thin.length} of ${rates.length} queries have fewer than ${minReads} reads. An interval` +
        `\n   computed over two readings is honest about being wide, but it is still two readings.`
    );
  }
  console.log(
    '\n⚠️ `contested` is the TRUE answer for a split query, not a failure of the niche. At K=5 only' +
      '\n   a unanimous query resolves — the interval is telling you the price of an answer.'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
