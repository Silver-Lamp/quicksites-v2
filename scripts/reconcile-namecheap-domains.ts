// scripts/reconcile-namecheap-domains.ts
//
// Reconcile the Namecheap account against `owned_domains`.
//
//   npx tsx --env-file=.env.local scripts/reconcile-namecheap-domains.ts "~/Downloads/Domain_List.csv"
//   npx tsx --env-file=.env.local scripts/reconcile-namecheap-domains.ts "<csv>" --write
//
// Export the CSV from Namecheap: Domain List → the export link (columns: Domain Name, privacy,
// status, auto-renew, expiration date).
//
// ⚠️ WHY THIS EXISTS. `syncOwnedDomains()` pulls the VERCEL account. Nothing pulls Namecheap, so
// domains bought there never enter the ledger by any automatic path — and the gap is silent in both
// directions:
//
//   • MISSING (undercount): a domain we pay to renew that the ledger has never heard of. Beyond the
//     cost report, the apex search checks the ledger, misses, falls through to the registrar and
//     reports "🔴 taken" for a domain we OWN. `renton-restaurant.com` was one click from being
//     bought a second time.
//   • UNVERIFIED (possible overcount): ledger rows in NEITHER registrar account — 69 of them on the
//     first run, mostly `source='external'` geo names like `lynn-hvac.com`. Those look like domains
//     we PLANNED to buy. If they are counted as spend, the renewal projection is inflated.
//
// ⚠️ IT NEVER DELETES. An unverified row might be owned somewhere this script cannot see (a third
// registrar, a transfer in flight). It reports them for a human; deciding a domain is not ours is
// not a decision a reconcile script gets to make from an absence.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { parseCsv } from '../lib/domains/namecheapCsv';

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: reconcile-namecheap-domains.ts <Domain_List.csv> [--write]');
    process.exit(1);
  }
  const write = process.argv.includes('--write');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Need NEXT_PUBLIC_SUPABASE_URL + a service-role key.');
  const s = createClient(url, key);

  const rows = parseCsv(readFileSync(file.replace(/^~/, process.env.HOME ?? '~'), 'utf8'));
  const { data, error } = await s.from('owned_domains').select('domain,source,registrar,expires_at,auto_renew');
  if (error) throw new Error(error.message);
  const ledger = new Map((data ?? []).map((d: any) => [String(d.domain).toLowerCase(), d]));

  const missing = rows.filter((r) => !ledger.has(r.domain));
  const present = rows.filter((r) => ledger.has(r.domain));
  const staleExpiry = present.filter((r) => {
    const l: any = ledger.get(r.domain);
    return r.expiresAt && String(l.expires_at ?? '').slice(0, 10) !== r.expiresAt.slice(0, 10);
  });

  console.log(`Namecheap CSV: ${rows.length}   ledger: ${ledger.size}`);
  console.log(`  missing from ledger:      ${missing.length}`);
  console.log(`  present, expiry to fix:   ${staleExpiry.length}`);

  const ncSet = new Set(rows.map((r) => r.domain));
  const unverified = (data ?? []).filter(
    (d: any) => !ncSet.has(String(d.domain).toLowerCase()) && d.registrar !== 'vercel',
  );
  console.log(`  in ledger, in NEITHER account: ${unverified.length}  ← review, never auto-deleted`);

  if (!write) {
    for (const m of missing) console.log(`  + ${m.domain}  exp=${m.expiresAt?.slice(0, 10)} auto=${m.autoRenew}`);
    console.log('\nDRY RUN — pass --write to insert/update.');
    return;
  }

  let added = 0;
  let fixed = 0;
  for (const m of missing) {
    const { error: e } = await s.from('owned_domains').insert({
      domain: m.domain,
      registrar: 'namecheap',
      source: 'manual',
      expires_at: m.expiresAt,
      auto_renew: m.autoRenew,
      notes: 'Reconciled from a Namecheap Domain List export. Nothing syncs Namecheap automatically.',
    });
    if (e) console.log(`  ✗ ${m.domain}: ${e.message}`);
    else added++;
  }
  for (const r of staleExpiry) {
    // Only fills facts the export is authoritative for. Never touches renewal_cents — the CSV has
    // no price column, and a cost invented here would silently become the projection's input.
    const { error: e } = await s
      .from('owned_domains')
      .update({ expires_at: r.expiresAt, auto_renew: r.autoRenew, registrar: 'namecheap' })
      .eq('domain', r.domain);
    if (e) console.log(`  ✗ ${r.domain}: ${e.message}`);
    else fixed++;
  }
  console.log(`\nadded ${added}, expiry corrected on ${fixed}`);
  console.log(`still unpriced: rows with no renewal_cents keep amortized (not by-renewal-date) projection.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
