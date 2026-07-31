// scripts/retire-stale-published-sites.ts
//
// Take a list of templates genuinely offline, then mark them archived.
//
// ⚠️ ARCHIVING DOES NOT UNPUBLISH. `templates.archived` is a flag the public renderer never
// reads: app/sites/[slug]/[[...rest]]/page.tsx serves whatever the most recent
// `published_sites` row points at, ignoring `archived`, `is_public`, `status`, and
// `templates.published` alike. Seven archived templates in this fleet still had live
// published_sites rows and were still serving pages — including several that were still
// serving a fabricated testimonial.
//
// So "archive it" means two operations, in this order:
//   1. DELETE the published_sites row  → the page actually stops resolving (this is exactly
//      what /api/admin/sites/unpublish does in its default "hard" mode)
//   2. set archived = true             → it leaves the working lists
//
// Doing only (2) leaves the page online while everyone believes it is retired, which is how
// these accumulated in the first place.
//
// Reversible: republishing recreates the published_sites row from a snapshot.
// Direct UPDATEs to `templates` are trigger-blocked (CLAUDE.md §8) → commitTemplatePatch.
//
//   npx tsx scripts/retire-stale-published-sites.ts            # dry run
//   npx tsx scripts/retire-stale-published-sites.ts --apply
import { supabaseAdmin } from '@/lib/supabase/admin';
import { commitTemplatePatch } from '@/lib/templates/commitTemplatePatch';

const APPLY = process.argv.includes('--apply');

/**
 * Owner-selected, 2026-07-30. These are the templates that were serving publicly while
 * `templates.published` said false — test copies and one-off drafts from Sep–Dec 2025.
 *
 * `electinfo` is DELIBERATELY ABSENT: owner says it is its own beast and stays online.
 */
const RETIRE = [
  'demo-marrowdale-restaurant',
  'niche-realty-l8tf',
  'maplevalley-towing-pnvc',
  'pnw-exteriorcleaning',
  'new-template-8a3a-obme',
  'new-template-3098-5wd0',
  'windshield-repair-1-josh-irao',
  'new-template-ad1b-czzj',
  'new-template-a32c-gouo',
  'new-template-0106-0piz',
];

async function main() {
  const { data: rows, error } = await supabaseAdmin
    .from('templates')
    .select('id, slug, rev, archived')
    .in('slug', RETIRE);
  if (error) throw error;

  const found = new Set((rows ?? []).map((r: any) => r.slug));
  for (const s of RETIRE) if (!found.has(s)) console.log(`  ? ${s}: no such template`);

  for (const t of (rows ?? []) as any[]) {
    const { data: pub } = await supabaseAdmin
      .from('published_sites')
      .select('id')
      .eq('template_id', t.id);
    const liveRows = pub?.length ?? 0;

    if (!APPLY) {
      console.log(`  · ${t.slug}: would delete ${liveRows} published_sites row(s), archived ${t.archived} → true`);
      continue;
    }

    // 1) Actually take it offline.
    if (liveRows) {
      const { error: delErr } = await supabaseAdmin
        .from('published_sites')
        .delete()
        .eq('template_id', t.id);
      if (delErr) {
        console.error(`  ✖ ${t.slug}: unpublish failed — ${delErr.message}`);
        continue;
      }
    }

    // 2) Then retire it from the working lists.
    const err = await commitTemplatePatch(t.id, t.rev ?? 0, { archived: true }, null);
    console.log(
      err
        ? `  ⚠ ${t.slug}: unpublished (${liveRows} row(s)) but archive failed — ${err}`
        : `  ✓ ${t.slug}: unpublished (${liveRows} row(s)) + archived`,
    );
  }

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply.');
    return;
  }

  // Verify against what the RENDERER uses — a published_sites row — not against the flags.
  const { data: after } = await supabaseAdmin
    .from('published_sites')
    .select('template_id, templates!inner(slug)')
    .in('templates.slug', RETIRE);
  console.log(`\nstill serving: ${after?.length ?? 0}`);
  if (after?.length) {
    for (const r of after as any[]) console.log(`  ✖ ${r.templates?.slug}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
