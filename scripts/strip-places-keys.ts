// scripts/strip-places-keys.ts
//
// One-off remediation: rewrite every stored Google Places photo URL that still carries
// GOOGLE_PLACES_API_KEY into the keyless proxy form (/api/public/place-photo?ref=…).
//
// The leak: lib/rebuild/importListing.ts built photo URLs with `&key=${GOOGLE_PLACES_API_KEY}`
// and those strings were persisted into `templates.data`. Every listing-import site rendered
// the key into public HTML, and GET /api/public/restaurant-directory returned it three times
// in a single unauthenticated response — harvestable by anyone, billable to the owner.
//
// The code path is fixed at the storage boundary (assembleDraft → stripPlacesKeysDeep); this
// cleans up rows written before that fix.
//
//   npx tsx scripts/strip-places-keys.ts            # dry run — reports, writes nothing
//   npx tsx scripts/strip-places-keys.ts --apply    # writes
//
// ⚠️ Rotating the key is a SEPARATE, OWNER-ONLY step. This script stops the key being
// *served*; it does not un-leak a key that has already been public. Anyone who harvested it
// still holds it until it is rotated in the Google Cloud console.
//
// Writes go through the sanctioned commit RPC — direct UPDATEs to `templates` are blocked by
// the app.guard_templates_update trigger.
import { createClient } from '@supabase/supabase-js';
import { stripPlacesKeysDeep, leaksApiKey } from '../lib/places/photoProxy';
// NOTE: commitTemplatePatch is imported DYNAMICALLY inside main(), not here. It pulls in
// lib/supabase/admin.ts, which builds its client at module-evaluation time — before this
// file's body runs. A static import would therefore read SUPABASE_SERVICE_ROLE_KEY before the
// mirror below sets it, and die with "supabaseKey is required".

const APPLY = process.argv.includes('--apply');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// Accept BOTH names. The app gets away with reading only SUPABASE_SERVICE_ROLE_KEY because
// instrumentation.ts maps SUPABASE_SECRET_KEY onto it at boot — but a standalone script never
// runs Next's boot hook, so a machine whose .env.local uses the newer name (this one does)
// fails with a bare "supabaseKey is required".
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
if (!url || !serviceKey) {
  console.error(
    'Need NEXT_PUBLIC_SUPABASE_URL and one of SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY',
  );
  process.exit(1);
}
// lib/supabase/admin.ts (imported transitively via commitTemplatePatch) reads the old name at
// module load, so mirror it before that import is evaluated.
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

function countKeyHits(s: string): number {
  return (s.match(/[?&]key=AIza/g) || []).length;
}

async function main() {
  const { commitTemplatePatch } = APPLY
    ? await import('../lib/templates/commitTemplatePatch')
    : { commitTemplatePatch: null as any };

  // ⚠️ PAGINATE. PostgREST caps a response at 1000 rows no matter what `.limit()` asks for,
  // and the fleet is ~2500 templates. The first version of this script requested 5000,
  // silently received the first 1000, found 1 of the 7 leaking rows, and printed a cheerful
  // success line. A security remediation that under-reports is worse than one that fails
  // loudly: it closes the ticket while the key is still being served.
  //
  // `.like()` on a jsonb column errors ("operator does not exist: jsonb ~~ unknown"), so the
  // match happens in JS over every page. Slower, and correct.
  const PAGE = 500;
  const rows: Array<{ id: string; slug: string; rev: number | null; data: unknown }> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('templates')
      .select('id, slug, rev, data')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      // Fail loudly — a partial scan must never be mistaken for a clean fleet.
      console.error(`page starting at ${from} failed: ${error.message}`);
      process.exit(1);
    }
    const page = (data ?? []) as any[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  console.log(`scanned ${rows.length} templates\n`);

  let affected = 0;
  let totalHits = 0;

  for (const row of rows) {
    const before = JSON.stringify(row.data ?? {});
    if (!leaksApiKey(before)) continue;

    const hits = countKeyHits(before);
    const cleaned = stripPlacesKeysDeep(row.data);
    const after = JSON.stringify(cleaned ?? {});

    affected += 1;
    totalHits += hits;
    console.log(`${APPLY ? 'FIX ' : 'DRY '} ${row.slug.padEnd(48)} ${hits} key occurrence(s)`);

    if (leaksApiKey(after)) {
      console.error(`  ⚠️ ${row.slug}: key STILL present after strip — investigate, not writing`);
      continue;
    }

    if (APPLY) {
      // Direct UPDATEs to `templates` are blocked by app.guard_templates_update; this is the
      // sanctioned path (CLAUDE.md §7) and handles the RPC-overload mess for us.
      const err2 = await commitTemplatePatch(row.id, row.rev ?? 0, { data: cleaned }, null);
      if (err2) console.error(`  ✗ ${row.slug}: ${err2}`);
    }
  }

  console.log(
    `\n${affected} template(s), ${totalHits} key occurrence(s) ${APPLY ? 'rewritten' : 'would be rewritten'}.`,
  );
  if (!APPLY && affected) console.log('Re-run with --apply to write.');
  if (APPLY && affected) {
    console.log('\n⚠️ NOW ROTATE GOOGLE_PLACES_API_KEY — this script stops it being served,');
    console.log('   it does not invalidate a key that was already public.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
