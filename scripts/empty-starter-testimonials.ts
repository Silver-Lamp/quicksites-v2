// scripts/empty-starter-testimonials.ts
//
// Remove the seeded fabricated testimonials from the published STARTER templates.
//
// ⚠️ WHY THESE AND NOT THE DEMOS' OWN SAKE. The starter businesses are fictional
// ("JetStream Pressure Washing" does not exist), so on their own pages nobody's real
// credibility is borrowed — the honest-scaffold standard's trigger is interpolating a REAL
// named entity. The reason to clear them is the DUPLICATION PATH:
//
//   app/api/templates/duplicate/route.ts does `{ ...src.data }` — a wholesale content copy.
//   It carefully strips `is_starter` and remaps commerce so a copy never routes money to the
//   source merchant, and it carries the testimonials through untouched.
//
// So every starter is a standing supply of fabricated 5-star reviews flowing into real
// businesses' sites — the exact violation #652 closed at the default and the generator, still
// reachable by a path those fixes don't cover. Emptying the starters is what actually closes
// it: with the default empty and the generator deleted, no fabricated review remains anywhere
// to be copied.
//
// ⚠️ COMMIT IS NOT PUBLISH. The renderer serves published_sites → template_versions.full_data,
// NOT templates.data. All 21 published SNAPSHOTS carry the quotes, so a commit alone changes
// nothing a visitor sees. republishIfPublished() re-snapshots; verification below reads the
// snapshot, not the draft.
//
// Direct UPDATEs to `templates` are trigger-blocked (CLAUDE.md §8) — writes go through
// commitTemplatePatch's sanctioned RPC.
//
//   npx tsx scripts/empty-starter-testimonials.ts           # dry run, changes nothing
//   npx tsx scripts/empty-starter-testimonials.ts --apply
import { supabaseAdmin } from '@/lib/supabase/admin';
import { commitTemplatePatch } from '@/lib/templates/commitTemplatePatch';
import { republishIfPublished } from '@/lib/templates/republishIfPublished';

const APPLY = process.argv.includes('--apply');

/** The seeded attributions. Matching these, not "any testimonial", so a real one is never touched. */
const SEEDED =
  /(Satisfied Client|Local Customer|Happy Homeowner|Relieved Customer|Grateful Client|Happy Client|They did a great job)/;

function stripTestimonials(data: any): { next: any; cleared: number } {
  const next = JSON.parse(JSON.stringify(data ?? {}));
  let cleared = 0;
  for (const page of next?.pages ?? []) {
    for (const key of ['content_blocks', 'blocks'] as const) {
      if (!Array.isArray(page?.[key])) continue;
      page[key] = page[key].map((b: any) => {
        if (b?.type !== 'testimonial') return b;
        // ⚠️ `b.content ?? b.props` is WRONG when content is an empty object: {} is truthy to
        // ??, so props is never consulted and a block storing its testimonials under `props`
        // reports as clean. florencetow hid a fabricated 5-star review behind exactly that.
        // Pick the side that actually holds the list.
        const fromContent = Array.isArray(b.content?.testimonials) ? b.content.testimonials : null;
        const fromProps = Array.isArray(b.props?.testimonials) ? b.props.testimonials : null;
        // ⚠️ BOTH SIDES CAN HOLD TESTIMONIALS, AND THEY DIFFER. Picking one is what three
        // successive attempts at this line got wrong. florencetow carries FOUR AI-generated
        // testimonials in `content` and the stock 'They did a great job!' in `props`; any rule
        // that selects a single side examines one and leaves the other in place. Filter each
        // independently and keep whatever is real on both.
        let touched = false;
        const next = { ...b };
        for (const key of ['content', 'props'] as const) {
          const holder = (b as any)[key];
          const items = Array.isArray(holder?.testimonials) ? holder.testimonials : null;
          if (!items?.length) continue;
          const keep = items.filter((it: any) => !SEEDED.test(JSON.stringify(it)));
          if (keep.length === items.length) continue;
          cleared += items.length - keep.length;
          (next as any)[key] = { ...holder, testimonials: keep };
          touched = true;
        }
        return touched ? next : b;
      });
    }
  }
  // ⚠️ THE FABRICATION ESCAPES THE BLOCKS. starter-junk-removal carried a `meta.talking_demo`
  // — a scripted audio walkthrough — whose step SPOKE the invented review aloud ("Here's what
  // people say: '…my place has never looked better.' — Happy Homeowner"), with an audio_url,
  // i.e. already rendered to speech. Clearing the testimonial blocks left it untouched and the
  // published snapshot still carried it. A content-shaped fix does not reach content that has
  // been copied into another medium, and only the snapshot check caught it.
  for (const step of next?.meta?.talking_demo?.steps ?? []) {
    if (SEEDED.test(JSON.stringify(step))) {
      cleared += 1;
      step.say = '';
      step.audio_url = '';
      step._removed_fabricated_quote = true;
    }
  }
  next.meta = next.meta ?? {};
  if (next.meta.talking_demo?.steps) {
    next.meta.talking_demo.steps = next.meta.talking_demo.steps.filter(
      (st: any) => !st?._removed_fabricated_quote,
    );
  }

  return { next, cleared };
}

async function main() {
  // Narrow at the DB, not in JS. Selecting `data` across every site pulls thousands of large
  // JSON blobs and trips the statement timeout — the identifying predicate belongs in the query.
  // ⚠️ PostgREST caps a response at 1000 rows no matter what you ask for. The fleet is ~2500
  // templates, so an unpaginated select silently examined 40% and reported success — the exact
  // bug that made an earlier backfill in this repo miss most of its targets. Page explicitly.
  const ids: any[] = [];
  for (let from = 0; ; from += 500) {
    const { data: page, error: pageErr } = await supabaseAdmin
      .from('templates')
      .select('id, slug, business_name, rev, published')
      .eq('is_site', true)
      // ⚠️ NOT filtering archived. Archiving a template does NOT unpublish it — six of these
      // kept a published_sites row and a live snapshot, so they were still serving a
      // fabricated review while being excluded from the cleanup for looking retired.
      .order('id', { ascending: true })
      .range(from, from + 499);
    if (pageErr) throw pageErr;
    if (!page?.length) break;
    ids.push(...page);
    if (page.length < 500) break;
  }
  const error = null;
  console.log(`scanned ${ids.length} templates`);
  // NOT scoped to starters. The snapshot check after the starter pass found TEN published
  // sites presenting as real named businesses (Covington/Florence/Elm Grove Towing, the geo
  // pitch sites) SERVING the block-default specimen — 'They did a great job!' / Happy Client /
  // rating 5. Those are the ones that actually matter: a fabricated five-star review on a page
  // carrying a real business's name.
  if (error) throw error;

  const starters: any[] = [];
  for (const row of (ids ?? []) as any[]) {
    const { data: full } = await supabaseAdmin
      .from('templates')
      .select('data')
      .eq('id', row.id)
      .maybeSingle();
    const d = (full as any)?.data;
    if (d && SEEDED.test(JSON.stringify(d))) starters.push({ ...row, data: d });
  }

  console.log(`${starters.length} starter(s) carrying seeded testimonials\n`);
  let changed = 0;
  let failed = 0;

  for (const t of starters as any[]) {
    const { next, cleared } = stripTestimonials(t.data);
    if (!cleared) {
      console.log(`  – ${t.slug}: nothing to clear`);
      continue;
    }
    if (!APPLY) {
      console.log(`  · ${t.slug}: would clear ${cleared} fabricated testimonial(s)`);
      continue;
    }
    const err = await commitTemplatePatch(t.id, t.rev ?? 0, { data: next }, null);
    if (err) {
      console.error(`  ✖ ${t.slug}: commit failed — ${err}`);
      failed++;
      continue;
    }
    // Commit alone leaves the published snapshot untouched, which is where visitors read from.
    const res = await republishIfPublished(t.id, t.published);
    console.log(`  ✓ ${t.slug}: cleared ${cleared} · republish=${JSON.stringify(res)}`);
    changed++;
  }

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply.');
    return;
  }

  // A clean draft does not imply a clean page: several towing sites had already-clean drafts
  // while their PUBLISHED SNAPSHOT still served the fabrication. Republish those — no content
  // change needed, the draft is already right, it just never reached the snapshot.
  const { data: dirty } = await supabaseAdmin
    .from('published_sites')
    .select('template_id, template_versions!inner(full_data)')
    .limit(2000);
  for (const row of (dirty ?? []) as any[]) {
    if (!SEEDED.test(JSON.stringify(row.template_versions?.full_data ?? {}))) continue;
    const { data: t } = await supabaseAdmin
      .from('templates').select('slug, published, data').eq('id', row.template_id).maybeSingle();
    if (!t) continue;
    if (SEEDED.test(JSON.stringify((t as any).data ?? {}))) continue; // handled by the pass above
    const res = await republishIfPublished(row.template_id, (t as any).published);
    console.log(`  ↻ ${(t as any).slug}: draft already clean, resnapshotted · ${JSON.stringify(res)}`);
  }

  // ⚠️ Verify against the SNAPSHOT, not the draft. The draft is not what anyone reads.
  // Fleet-wide, NOT scoped to the templates this run touched — scoping the check to what you
  // already decided to fix is how "2 remaining" was reported when the real number was 8.
  const { data: rows } = await supabaseAdmin
    .from('published_sites')
    .select('template_id, snapshot_id, template_versions!inner(full_data)')
    .limit(2000);
  const stillFake = (rows ?? []).filter((r: any) => SEEDED.test(JSON.stringify(r.template_versions?.full_data ?? {})));

  console.log(`\nchanged=${changed} failed=${failed}`);
  console.log(`published snapshots still carrying a seeded testimonial: ${stillFake.length}`);
  if (stillFake.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
