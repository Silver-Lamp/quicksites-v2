// scripts/backfill-prospect-addresses.ts
//
// Give the legacy trade drafts a street to mail to.
//
//   npm run outreach:backfill-addresses                       # DRY: look every one up, write nothing
//   npm run outreach:backfill-addresses -- --apply            # write the accepted addresses back
//   npm run outreach:backfill-addresses -- --apply --dismiss-duplicates
//                                                             # also dismiss legacy rows a later sweep
//                                                             # re-found under a real place_id
//   npm run outreach:backfill-addresses -- --limit 5          # first N needing it (for a cheap look)
//   npm run outreach:backfill-addresses -- --apply --allow 8d9f6a11,ab12cd34
//                                                             # accept these eyeballed rows past the
//                                                             # city/distance rule (never past a duplicate)
//   npm run outreach:backfill-addresses -- --apply --skip a669ffac
//                                                             # leave these rows alone this run
//   (ids may be the full uuid or its first 8 characters, as the table prints them)
//
// Why this exists and why a re-sweep cannot do it: header of lib/outreach/addressBackfill.ts.
// Spend: one Places Text Search per row that needs it (~22 today) — cents, not dollars.
//
// ⚠️ Dry by default. Read the table — the match name beside the stored name is the whole review —
// before re-running with --apply. `--dismiss-duplicates` is a second, separate decision: it changes
// the status of a row with a live draft site behind it.
if (typeof (globalThis as any).WebSocket === 'undefined') {
  try {
    // @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
    const ws = (await import('ws')).default;
    (globalThis as any).WebSocket = ws;
  } catch {
    /* ignore */
  }
}

import { createClient } from '@supabase/supabase-js';
import { searchPlaceByText } from '../lib/places/searchText';
import {
  backfillProspectAddresses,
  needsAddressBackfill,
  type BackfillCandidate,
  type BackfillRow,
} from '../lib/outreach/addressBackfill';

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Standalone scripts don't get instrumentation.ts's SUPABASE_SECRET_KEY → SERVICE_ROLE mapping.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY).');
    process.exit(1);
  }
  return createClient(url, key);
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? '') : null;
}

const SELECT = 'id, place_id, business_name, address, city, region, status, template_id, address_lat, address_lon';

/** `--allow a1b2c3d4,…` → the full ids of the rows whose id starts with each token. */
function idSet(name: string, rows: { id: string }[]): Set<string> {
  const raw = (arg(name) ?? '').split(',').map((t) => t.trim()).filter(Boolean);
  const out = new Set<string>();
  for (const tok of raw) {
    const hits = rows.filter((r) => r.id === tok || r.id.startsWith(tok));
    if (hits.length !== 1) {
      console.error(`--${name} ${tok}: matched ${hits.length} rows, need exactly 1.`);
      process.exit(1);
    }
    out.add(hits[0].id);
  }
  return out;
}

async function main() {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.error('GOOGLE_PLACES_API_KEY is not set.');
    process.exit(1);
  }
  const apply = flag('apply');
  const dismissDuplicates = flag('dismiss-duplicates');
  const limit = Number(arg('limit') ?? '0') || 0;
  const s = db();

  // The same population the mail step selects from: built, unmailed, no-website, not a restaurant.
  const { data, error } = await s
    .from('outreach_prospects')
    .select(SELECT)
    .eq('status', 'draft_built')
    .eq('lead_tier', 'no_website')
    .is('postcard_sent_at', null)
    .not('template_id', 'is', null)
    .neq('industry_key', 'restaurant')
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw new Error(`select prospects: ${error.message}`);
  let candidates = ((data ?? []) as BackfillCandidate[]).filter(needsAddressBackfill);
  const allow = idSet('allow', candidates);
  const skip = idSet('skip', candidates);
  if (limit) candidates = candidates.slice(0, limit);

  // Every place_id in the table, so a result another row already owns is caught, not written.
  const { data: all, error: allErr } = await s.from('outreach_prospects').select('id, place_id').limit(10000);
  if (allErr) throw new Error(`select place_ids: ${allErr.message}`);
  const existingPlaceIds = new Map<string, string>();
  for (const r of (all ?? []) as { id: string; place_id: string }[]) if (r.place_id) existingPlaceIds.set(r.place_id, r.id);

  console.log(`${apply ? 'APPLY' : 'DRY RUN'} — ${candidates.length} built, unmailed drafts have no street address${dismissDuplicates ? ' (duplicates will be dismissed)' : ''}\n`);

  const report = await backfillProspectAddresses(
    candidates,
    {
      search: (q) => searchPlaceByText(q),
      existingPlaceIds,
      writeAddress: async (id, address, lat, lon) => {
        const { error: uErr } = await s
          .from('outreach_prospects')
          .update({ address, address_lat: lat, address_lon: lon, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (uErr) throw new Error(`update ${id}: ${uErr.message}`);
      },
      dismiss: async (id) => {
        const { error: dErr } = await s
          .from('outreach_prospects')
          .update({ status: 'dismissed', updated_at: new Date().toISOString() })
          .eq('id', id);
        if (dErr) throw new Error(`dismiss ${id}: ${dErr.message}`);
      },
    },
    { apply, dismissDuplicates, allow, skip },
  );

  const pad = (v: string | number | null | undefined, n: number) => String(v ?? '').slice(0, n).padEnd(n);
  console.log(`${pad('prospect', 8)} ${pad('stored name', 34)} ${pad('google name', 34)} ${pad('score', 5)} ${pad('verdict', 14)} detail`);
  for (const r of report.rows as BackfillRow[]) {
    const v = r.verdict;
    const verdict = v.accept ? (r.written ? 'WRITTEN' : 'accept') + (v.allowed ? '!' : v.cityDiffers ? '*' : '') : (r.dismissed ? 'DISMISSED' : v.reason);
    const km = v.accept && v.cityDiffers && v.distanceKm != null ? ` (${Math.round(v.distanceKm)} km)` : '';
    const detail = v.accept ? v.address + km : v.reason === 'duplicate_of' ? `→ ${v.duplicateOf?.slice(0, 8)} (${v.detail})` : v.detail ?? '';
    console.log(`${pad(r.prospectId, 8)} ${pad(r.businessName, 34)} ${pad(r.matchName, 34)} ${pad(v.nameScore.toFixed(2), 5)} ${pad(verdict, 14)} ${detail}`);
  }
  console.log(`\nneeded ${report.needed} · accepted ${report.accepted} · written ${report.written} · dismissed ${report.dismissed}`);
  console.log(`rejected: ${Object.entries(report.rejected).map(([k, n]) => `${k} ${n}`).join(' · ') || 'none'}`);
  if (report.rows.some((r) => r.verdict.accept && r.verdict.cityDiffers && !r.verdict.allowed)) console.log('* accepted on a near-exact name within 60 km, but Google puts it in a different town than the row says — eyeball it.');
  if (report.rows.some((r) => r.verdict.accept && r.verdict.allowed)) console.log('! accepted because you passed --allow for it.');
  if (report.rejected.too_far) console.log('too_far: same state, same name, but beyond 60 km of the row\'s coordinates — a generic trade name in another county. Pass --allow <id> only after checking it yourself.');
  if (!apply && report.accepted) console.log(`\nRe-run with --apply to write ${report.accepted} address${report.accepted === 1 ? '' : 'es'}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
