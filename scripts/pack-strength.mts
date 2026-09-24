// scripts/pack-strength.mts
//
// Rescore every stored SERP reading for PACK WEAKNESS. Spends nothing: DataForSEO already returns
// `rating.votes_count` on each local_pack item and we already store the raw, so this is a second
// look at data we have owned all along.
//
//   npx tsx --env-file=.env.local scripts/pack-strength.mts
//   npx tsx --env-file=.env.local scripts/pack-strength.mts --days=30 --only=treehouse,bunker
//
// ⚠️ WHAT THIS IS FOR. `classify.ts` calls every full pack `skip`, which is right about towing and
// throws away the difference between three businesses with 4 reviews and three with 500. This finds
// the queries we marked `skip` whose pack is actually WEAK — the ones worth a hand check rather
// than a write-off. It changes no verdict; it produces a shortlist.

// @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
import ws from 'ws';
(globalThis as any).WebSocket ??= ws;

import type { PackListing } from '@/lib/serp/packStrength';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];

async function main() {
  const { readPackStrength, packListingsFromRaw, WEAK_REVIEW_COUNT } = await import(
    '@/lib/serp/packStrength'
  );
  const { NICHE_CANDIDATES } = await import('@/lib/niches/candidates');
  const { supabaseAdmin } = await import('@/lib/supabase/admin');

  const days = Number(arg('days') ?? 7);
  const only = (arg('only') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('serp_observations')
    .select('niche_key,query,location,verdict,pack_size,raw,checked_at')
    .gte('checked_at', since)
    .limit(5000);
  if (error) throw error;

  type Row = { key: string; query: string; location: string; verdict: string; listings: PackListing[] };
  const latest = new Map<string, Row & { at: string }>();
  for (const r of data ?? []) {
    const key = String((r as any).niche_key ?? '(control)');
    if (only.length && !only.includes(key)) continue;
    const id = `${key}|${(r as any).query}|${(r as any).location}`;
    const at = String((r as any).checked_at);
    const prev = latest.get(id);
    if (prev && prev.at >= at) continue;
    latest.set(id, {
      key,
      query: String((r as any).query),
      location: String((r as any).location),
      verdict: String((r as any).verdict),
      listings: packListingsFromRaw((r as any).raw),
      at,
    });
  }

  const label = (k: string) => NICHE_CANDIDATES.find((c) => c.key === k)?.label ?? k;

  // Per niche: how established is the competition actually.
  const byNiche = new Map<string, { listings: number; weak: number; votes: number[] }>();
  // The shortlist: we called it skip, but the pack is weak.
  const rescue: { key: string; query: string; location: string; desc: string }[] = [];

  for (const r of latest.values()) {
    if (!r.listings.length) continue;
    const s = readPackStrength(r.listings);
    const b = byNiche.get(r.key) ?? { listings: 0, weak: 0, votes: [] };
    b.listings += s.listings;
    b.weak += s.weak;
    for (const l of r.listings) if (typeof l.votes === 'number') b.votes.push(l.votes);
    byNiche.set(r.key, b);

    if (r.verdict === 'skip' && s.isWeak) {
      rescue.push({
        key: r.key,
        query: r.query,
        location: r.location.split(',')[0],
        desc: `${s.weak}/${s.listings} under ${WEAK_REVIEW_COUNT}` +
          (s.medianVotes === null ? ', none rated' : `, median ${s.medianVotes}`),
      });
    }
  }

  const median = (xs: number[]) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
  };

  console.log(`\nPack strength from stored readings, last ${days} day(s). No new spend.\n`);
  console.log('median  weak/listings  niche');
  console.log('─'.repeat(78));
  const rows = [...byNiche.entries()]
    .map(([k, b]) => ({ k, med: median(b.votes), weak: b.weak, listings: b.listings }))
    .sort((a, b) => (a.med ?? -1) - (b.med ?? -1));
  for (const r of rows) {
    const med = r.med === null ? '  none' : String(r.med).padStart(6);
    console.log(`${med}  ${`${r.weak}/${r.listings}`.padStart(13)}  ${label(r.k)}`);
  }

  console.log(
    '\n⚠️ Read this against the two controls, which is the only reason it is trustworthy:' +
      '\n   towing (a measured LOSS — 69 impressions, zero clicks) sits near the bottom with a' +
      '\n   median in the hundreds. Treehouses (bought, working) sit at the top with a median in' +
      '\n   single digits. A niche near towing is competing with established businesses.'
  );

  if (rescue.length) {
    console.log(`\n\n🔍 ${rescue.length} query(s) we called "skip" whose pack is actually WEAK:\n`);
    for (const r of rescue.slice(0, 25)) {
      console.log(`   ${label(r.key).padEnd(34)} "${r.query}" @ ${r.location}  —  ${r.desc}`);
    }
    if (rescue.length > 25) console.log(`   … and ${rescue.length - 25} more`);
    console.log(
      '\n⚠️ These are NOT now green. A full pack still sits above organic, and the classifier is' +
        '\n   calibrated against a person on that rule. What a weak pack changes is whether the page' +
        '\n   is worth LOOKING at by hand — which is the step that has caught every mistake today.'
    );
  } else {
    console.log('\nNo skipped query had a weak pack in this window.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
