// scripts/retire-stale-demo-sites.ts
//
// Take the PRE-REFRESH demo sites offline, so the demo cohort is uniformly current.
//
// ⚠️ WHY THIS EXISTS. `generateDemoSite` INSERTS a new template from a random spec — it does not
// refresh an existing one. So regenerating the cohort ADDS sites rather than replacing them, and
// the old ones keep serving. After the 2026-08-01 refresh the fleet held 21 demo_seed sites: 10
// new (all with service descriptions) and 11 older (none). A persona picking a demo at random
// had a ~52% chance of grading output built before the week's fixes — which is precisely the
// problem the refresh was meant to solve, still half-unsolved.
//
// ⚠️ ARCHIVING DOES NOT UNPUBLISH. `templates.archived` is a flag the public renderer never
// reads; it serves whatever snapshot the `published_sites` row points at, ignoring `archived`,
// `is_public`, `status` and `templates.published` alike. Seven archived templates in this fleet
// were still serving pages when that was discovered. So retiring is TWO steps, in this order:
//
//   1. DELETE the published_sites row  → the page actually stops resolving
//   2. set archived = true             → it leaves the working lists
//
// Doing only (2) produces a site that looks retired in every admin surface and is still live on
// the internet, which is the worst of both.
//
// REVERSIBLE: nothing is deleted except the pointer row. Republishing recreates it from a
// snapshot, and the template, its data and its version history are untouched.
//
//   npx tsx scripts/retire-stale-demo-sites.ts            # dry run — prints, changes nothing
//   npx tsx scripts/retire-stale-demo-sites.ts --apply
import { supabaseAdmin } from '@/lib/supabase/admin';
import { commitTemplatePatch } from '@/lib/templates/commitTemplatePatch';

const APPLY = process.argv.includes('--apply');

/** Sites generated on/after this date are the current cohort and are KEPT. */
const REFRESH_DATE = process.argv.find((a) => a.startsWith('--since='))?.split('=')[1] ?? '2026-08-01';

/** True when a template's services carry any description — the marker of the current generator. */
function hasServiceDescriptions(data: any): boolean {
  const blocks = (data?.pages ?? []).flatMap((p: any) => [...(p.blocks ?? []), ...(p.content_blocks ?? [])]);
  const svc = blocks.find((b: any) => b?.type === 'services');
  const items = (svc?.content ?? svc?.props ?? {}).items ?? [];
  return items.some((i: any) => String(i?.description ?? '').trim());
}

async function main() {
  const { data: rows, error } = await supabaseAdmin
    .from('templates')
    .select('id, slug, rev, archived, created_at, data')
    .eq('claim_source', 'demo_seed')
    .order('created_at', { ascending: true });
  if (error) throw error;

  // Belt and braces: select by DATE, then confirm by CONTENT. A site that already carries
  // descriptions is current whatever its timestamp says, and must never be retired by a
  // date arithmetic slip.
  const targets = (rows ?? []).filter(
    (t: any) => t.created_at.slice(0, 10) < REFRESH_DATE && !hasServiceDescriptions(t.data),
  );
  const kept = (rows ?? []).length - targets.length;

  console.log(`demo_seed templates: ${rows?.length ?? 0}`);
  console.log(`  keeping ${kept} (generated on/after ${REFRESH_DATE}, or already carrying descriptions)`);
  console.log(`  retiring ${targets.length}:\n`);

  for (const t of targets as any[]) {
    const { data: pub } = await supabaseAdmin
      .from('published_sites')
      .select('id')
      .eq('template_id', t.id)
      .maybeSingle();

    const serving = !!pub;
    console.log(`  ${t.slug}  (${t.created_at.slice(0, 10)})  serving=${serving}  archived=${t.archived}`);

    if (!APPLY) continue;

    // 1) Stop it serving. This is the step that actually does something.
    if (pub) {
      const { error: delErr } = await supabaseAdmin.from('published_sites').delete().eq('id', pub.id);
      if (delErr) {
        console.log(`     ✗ could not unpublish: ${delErr.message}`);
        continue;
      }
    }

    // 2) Take it out of the working lists. Direct UPDATEs to `templates` are trigger-blocked,
    //    so this goes through the sanctioned commit RPC like every other server-side write.
    if (!t.archived) {
      const err = await commitTemplatePatch(t.id, t.rev ?? 0, { archived: true }, null);
      if (err) console.log(`     ✗ could not archive: ${err}`);
    }
    console.log('     ✓ retired');
  }

  if (!APPLY) console.log('\nDry run — nothing changed. Re-run with --apply.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
