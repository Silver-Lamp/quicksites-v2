// scripts/fix-unclaimable-listing-drafts.ts
//
// Restore watermark + noindex + claim bar on unclaimed listing-import drafts that a stale
// `published_sites` row had quietly promoted to "published".
//
// THE BUG. A listing-import draft is a site we auto-built for a REAL, NAMED business from
// their public listing, without asking them. The design (CLAUDE.md, delivered.menu section)
// is that such a draft renders watermarked + `noindex`, carrying a "Claim this site" bar, and
// only becomes indexable once the owner claims it. All three properties hang off one flag in
// app/sites/[slug]/[[...rest]]/page.tsx:
//
//     isDraft      = we fell back to the draft because there was no published snapshot
//     showWatermark = isDraft && menuHost
//     showClaimBar  = isDraft && menuHost && claimSource === 'listing_import'
//
// So a `published_sites` row with a live `snapshot_id` flips all three off at once — even
// while `templates.published` is still false. The result is the worst combination available:
// a real business's page, presenting as theirs, INDEXABLE by Google, with the owner's only
// route to take it over removed. Found by auditing what renton-restaurant.com links to.
//
// THE FIX is to null the snapshot pointer so the renderer falls back to the draft path.
//
// ⚠️ Why not POST /api/admin/sites/unpublish?mode=soft — its soft branch sets `domain: null`,
// but `published_sites.domain` is NOT NULL, so that update errors. Fixing the route is a
// separate change; this script does the correct thing and leaves `domain` alone.
//
// SCOPE IS DELIBERATELY NARROW: only `claim_source = 'listing_import'` AND
// `templates.published = false`. The same query without the claim_source filter matches 10
// more templates with no claim_source at all — those are ordinary sites whose publish state
// is not this bug, and unpublishing them would take real sites offline.
//
//   npx tsx scripts/fix-unclaimable-listing-drafts.ts            # dry run
//   npx tsx scripts/fix-unclaimable-listing-drafts.ts --apply
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
if (!url || !serviceKey) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY');
  process.exit(1);
}
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  const { data: rows, error } = await db
    .from('templates')
    .select('id, slug, claim_source, published, published_sites(id, domain, snapshot_id, status)')
    .eq('published', false)
    .eq('claim_source', 'listing_import');

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const affected = (rows ?? []).filter((r: any) => {
    const ps = Array.isArray(r.published_sites) ? r.published_sites[0] : r.published_sites;
    return ps && ps.snapshot_id && (ps.status ?? 'published') !== 'unpublished';
  });

  if (!affected.length) {
    console.log('No unclaimable listing-import drafts found. Nothing to do.');
    return;
  }

  console.log(
    `${affected.length} unclaimed listing-import draft(s) are currently INDEXABLE and have no claim bar:\n`,
  );
  for (const r of affected as any[]) {
    const ps = Array.isArray(r.published_sites) ? r.published_sites[0] : r.published_sites;
    console.log(`  ${APPLY ? 'FIX ' : 'DRY '} ${r.slug.padEnd(46)} publish-row domain: ${ps.domain}`);
  }

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to restore watermark + noindex + claim bar.');
    return;
  }

  console.log('');
  for (const r of affected as any[]) {
    const ps = Array.isArray(r.published_sites) ? r.published_sites[0] : r.published_sites;
    // Null ONLY the snapshot pointer (plus the status/visibility flags). `domain` stays — it
    // is NOT NULL, and it is also the record of where this was once published, which is worth
    // keeping for anyone auditing how it happened.
    const { error: upErr } = await db
      .from('published_sites')
      .update({ snapshot_id: null, status: 'unpublished', is_public: false, published_at: null })
      .eq('id', ps.id);
    if (upErr) console.error(`  ✗ ${r.slug}: ${upErr.message}`);
    else console.log(`  ✓ ${r.slug} — draft path restored`);
  }

  console.log('\nVerify on the live URLs: each should now show the watermark, a "Claim this');
  console.log('site" bar, and a noindex tag.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
