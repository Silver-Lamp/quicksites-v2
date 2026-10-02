// scripts/republish-font-backfill.mjs
//
// Push the typeface backfill out to the live pages that are still serving a pre-backfill
// snapshot.
//
//   node scripts/republish-font-backfill.mjs                 # dry run, writes nothing
//   node scripts/republish-font-backfill.mjs --apply --limit 10
//
// ⚠️ THE BACKFILL WROTE `templates.data`; VISITORS ARE SERVED A SNAPSHOT. 41 published sites
// had a `fontPair` in the draft and a published snapshot minted before it, so their typeface
// reached nobody. `southhilltowing.com` was the proof: draft `archivo-inter`, live page loading
// no font file at all. A DB row is not a page (CLAUDE.md §9).
//
// ⚠️ THIS CHANGES REAL BUSINESSES' LIVE PAGES. Owner-approved 2026-10-02. It is deliberately
// batched and dry-run-by-default, and it re-reads every condition per row at write time rather
// than trusting the list it printed a moment ago.
//
// ⚠️ IT REPUBLISHES ONLY — IT NEVER EDITS CONTENT. The draft already holds everything we want
// live; the single job here is to mint a snapshot from it. Anything that rewrote copy on the
// way out would be a second, unreviewed change riding along with a font.

import { loadEnv, makeRest, republishTemplate } from './lib/republishTemplate.mjs';

const APPLY = process.argv.includes('--apply');
const LIMIT = Number(process.argv[process.argv.indexOf('--limit') + 1]) || (APPLY ? 10 : 200);

const env = loadEnv();
const rest = makeRest(env);

const pairOf = (d) => d?.meta?.theme?.fontPair ?? null;

async function main() {
  // ⚠️ THERE ARE TWO SNAPSHOTS AND A SITE CAN BE STALE IN EITHER. `published_sites` →
  // `template_versions` serves a platform slug; the legacy `sites.published_snapshot_id` →
  // `snapshots` serves a CUSTOM DOMAIN, and `app/host` reads `snapshots.data`. Checking only
  // the first reports success while a customer's own domain still serves the old bytes —
  // which is exactly what the first run of this script did to graftontowing.com.
  const rows = await rest(
    'published_sites?select=template_id,snapshot_id,domain,' +
      'templates(id,slug,rev,data,published),' +
      'template_versions!published_sites_snapshot_id_fkey(id,full_data)&limit=1000',
  );
  const legacy = await rest('sites?select=slug,domain,published_snapshot_id,snapshots(id,data)&limit=1000');
  const legacyBySlug = new Map((legacy ?? []).filter((l) => l.slug).map((l) => [l.slug, l]));

  const stale = [];
  for (const r of rows ?? []) {
    const tpl = r.templates;
    if (!tpl) continue;
    const draftPair = pairOf(tpl.data);
    if (!draftPair) continue;

    const servedPair = pairOf(r.template_versions?.full_data);
    const leg = legacyBySlug.get(tpl.slug);
    const legacyPair = leg?.published_snapshot_id ? pairOf(leg.snapshots?.data) : draftPair; // no row → nothing to be stale

    // Stale if EITHER thing a visitor could be served lacks the pairing.
    if (!servedPair || !legacyPair) {
      stale.push({
        id: tpl.id, slug: tpl.slug, rev: tpl.rev, data: tpl.data, pair: draftPair,
        domain: leg?.domain ?? r.domain,
        why: [!servedPair && 'platform', !legacyPair && 'domain'].filter(Boolean).join('+'),
      });
    }
  }

  console.log(`\n${rows?.length ?? 0} published site(s) · ${stale.length} serving a snapshot with no typeface\n`);
  for (const s of stale.slice(0, 12)) {
    console.log(`  ${(s.slug ?? '(no slug)').padEnd(30)} ${String(s.domain ?? '').padEnd(26)} ${s.why.padEnd(14)} → ${s.pair}`);
  }
  if (stale.length > 12) console.log(`  … and ${stale.length - 12} more`);

  if (!APPLY) {
    console.log(`\nNothing written. Re-run with --apply --limit N.\n`);
    return;
  }

  const batch = stale.slice(0, LIMIT);
  console.log(`\nRepublishing ${batch.length}…`);
  let ok = 0;
  for (const s of batch) {
    try {
      // ⚠️ Re-read under a fresh fetch: the survey above is a snapshot and a site could have
      // been republished by hand in between. Doing it again would be harmless here, but the
      // habit is what stops the next script from being destructive.
      const [fresh] = await rest(`templates?id=eq.${s.id}&select=id,slug,rev,data,published`);
      if (!fresh?.published) { console.log(`  · ${s.slug}: no longer published, skipped`); continue; }
      if (!pairOf(fresh.data)) { console.log(`  · ${s.slug}: pairing gone, skipped`); continue; }

      // ⚠️ THE TRANSFORM IS NOT OPTIONAL AND A NO-OP IS THE TRAP. `republishTemplate` mints
      // the legacy snapshot by CLONING THE PINNED ONE and applying this function — it does not
      // copy the draft. Passing `() => {}` therefore republishes the platform URL correctly and
      // re-pins the custom domain to a fresh copy of the STALE content, reporting
      // "+domain snapshot" either way. That is what happened to graftontowing.com on the first
      // run: the script said ✓, the row changed, and the live page still loaded no font.
      //
      // Copy the THEME ONLY, never the whole draft: a draft can hold unreviewed edits, and
      // pushing those to a live business's domain under cover of a font change is a second,
      // unasked-for deploy.
      const theme = fresh.data?.meta?.theme;
      const { repointed } = await republishTemplate(
        rest, fresh, fresh.data,
        (snap) => {
          if (!theme) return;
          snap.data = snap.data ?? {};
          snap.data.meta = { ...(snap.data.meta ?? {}), theme: { ...(snap.data.meta?.theme ?? {}), ...theme } };
        },
        'republish: carry the typeface backfill to the live page',
      );
      console.log(`  ✓ ${(fresh.slug ?? s.id).padEnd(34)} ${pairOf(fresh.data)}${repointed ? ' (+domain snapshot)' : ''}`);
      ok += 1;
    } catch (e) {
      console.warn(`  ⚠ ${s.slug}: ${e?.message ?? e}`);
    }
  }
  console.log(`\n✅ ${ok}/${batch.length} republished. ${stale.length - ok} remain.`);
  console.log('   Verify a page, never the row: curl the site and grep for fonts.googleapis.com\n');
}

main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
