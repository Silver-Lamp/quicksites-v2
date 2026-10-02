// scripts/backfill-font-pairs.mts
//
// Give every site a typeface.
//
//   npx tsx scripts/backfill-font-pairs.mts                 # dry run — writes nothing
//   npx tsx scripts/backfill-font-pairs.mts --apply --limit 50
//
// ⚠️ 2,452 of 3,231 templates had no `fontPair` and rendered in `ui-sans-serif` — the system
// stack, i.e. no typographic choice at all. The pairing system, its loader and eleven curated
// pairs were built and unreachable. This is a reachability backfill, not a redesign.
//
// ⚠️ IT NEVER OVERWRITES AN OWNER'S CHOICE. Only templates with no `fontPair` are touched, the
// same rule `applyBackdropUpgrade` follows. Somebody picked Fraunces on purpose; a bulk job that
// "improves" it is vandalism with good intentions.
//
// ⚠️ IT WRITES THROUGH THE SANCTIONED RPC. Direct UPDATEs to `templates` are blocked by
// `app.guard_templates_update` — go through `commitTemplatePatch`, never `.update()`.
//
// ⚠️ A PUBLISHED SITE NEEDS RE-PUBLISHING for the change to reach a visitor: the renderer serves
// the snapshot in `published_sites`, not `templates.data`. This script deliberately does NOT
// republish — changing the typeface of a live business's site is a visible change, and it should
// go out when a person decides to, in batches they are watching.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { fontPairForIndustry, INDUSTRY_FONT_MOOD, DEFAULT_FONT_MOOD } from '@/lib/theme/industryFontMood';
import { installNodeWebSocket } from '@/lib/supabase/nodeWebSocketShim';

const APPLY = process.argv.includes('--apply');
const LIMIT = Number(process.argv[process.argv.indexOf('--limit') + 1]) || (APPLY ? 50 : 5000);

// ⚠️ The SURVEY never selects `data`. Pulling the full template jsonb for 3,231 rows times the
// statement out — the first paged version died on exactly that. PostgREST can project JSON
// paths, so the survey reads two scalars and the writer fetches the whole row one at a time.
type Row = {
  id: string; slug: string | null; published: boolean | null; rev: number | null;
  industry: string | null; font_pair: string | null; page_count: number | null;
};

async function main() {
  await installNodeWebSocket();
  const { supabaseAdmin } = await import('@/lib/supabase/admin');

  // ⚠️ PAGE THROUGH. PostgREST caps a response at 1000 rows whatever `.limit()` says — the
  // first run of this script reported "566 would get one" out of 1000 templates when the fleet
  // is 3,231. A capped read looks exactly like a small fleet.
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('templates')
      .select('id, slug, published, rev, industry:data->meta->>industry, font_pair:data->meta->theme->>fontPair, page_count:data->pages')
      .range(from, from + 999);
    if (error) throw new Error(`read failed: ${error.message}`);
    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  const todo: Array<{ id: string; slug: string; industry: string; pair: string }> = [];
  let alreadySet = 0;

  let shells = 0;
  for (const r of rows) {
    if (r.font_pair) { alreadySet += 1; continue; }
    // ⚠️ SKIP EMPTY SHELLS. 1,197 of 2,446 templates needing a pairing have ZERO pages —
    // abandoned `<slug>-xxxx` variants with no content. A typeface on a site with no pages is
    // a write nobody will ever see, and it would halve the signal in any before/after.
    const pages = Array.isArray(r.page_count) ? r.page_count.length : 0;
    if (pages === 0) { shells += 1; continue; }
    const industry = String(r.industry ?? '');
    const pair = fontPairForIndustry(industry, r.slug ?? r.id);
    if (!pair) continue;
    todo.push({ id: r.id, slug: r.slug ?? '(no slug)', industry: industry || '(none)', pair });
  }

  // What the mapping decides, by industry — the thing to eyeball before writing anything.
  const byIndustry = new Map<string, { pair: string; n: number }>();
  for (const t of todo) {
    const k = `${t.industry} → ${t.pair}`;
    byIndustry.set(k, { pair: t.pair, n: (byIndustry.get(k)?.n ?? 0) + 1 });
  }

  console.log(`\n${rows.length} templates · ${alreadySet} already paired · ${shells} empty shells skipped · ${todo.length} would get one\n`);
  console.log('  industry → pairing                                   sites');
  [...byIndustry.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 30)
    .forEach(([k, v]) => console.log(`  ${k.padEnd(52)} ${String(v.n).padStart(5)}`));

  const unmapped = [...new Set(todo.map((t) => t.industry))].filter(
    (i) => i !== '(none)' && !(i in INDUSTRY_FONT_MOOD),
  );
  if (unmapped.length) {
    console.log(`\n  ⚠ ${unmapped.length} industry(ies) fall through to '${DEFAULT_FONT_MOOD}': ${unmapped.join(', ')}`);
  }

  if (!APPLY) {
    console.log(`\nNothing written. Re-run with --apply --limit N (batches; default ${50}).\n`);
    return;
  }

  const { commitTemplatePatch } = await import('@/lib/templates/commitTemplatePatch');
  // ⚠️ DRAFTS FIRST. A published site keeps serving its old snapshot until re-published, so a
  // change there is invisible until someone acts — but if they do, a real business's typeface
  // changes. An unpublished draft is where you look at the result with nothing at stake.
  const isDraft = (id: string) => rows.find((r) => r.id === id)?.published !== true;
  const batch = [...todo].sort((a, b) => Number(isDraft(b.id)) - Number(isDraft(a.id))).slice(0, LIMIT);
  const drafts = batch.filter((t) => isDraft(t.id)).length;
  console.log(`  ${drafts} draft(s), ${batch.length - drafts} published`);
  console.log(`\nApplying to ${batch.length} template(s)…`);
  let ok = 0;
  for (const t of batch) {
    try {
      // Fetch the full row only for the one being written — see the Row comment.
      const { data: full, error: readErr } = await supabaseAdmin
        .from('templates').select('data, rev').eq('id', t.id).maybeSingle();
      if (readErr || !full) { console.warn(`  ⚠ ${t.slug}: ${readErr?.message ?? 'not found'}`); continue; }
      const row: any = full;
      const meta = { ...(row.data?.meta ?? {}) };
      // ⚠️ Re-check under the fresh read: somebody may have chosen a face since the survey.
      if (meta?.theme?.fontPair) { console.log(`  · ${t.slug}: already set, skipped`); continue; }
      meta.theme = { ...(meta.theme ?? {}), fontPair: t.pair };
      // (id, baseRev, patch, actorId) — baseRev guards against clobbering a concurrent edit.
      await commitTemplatePatch(t.id, row.rev ?? 0, { data: { ...row.data, meta } }, null);
      console.log(`  ✓ ${t.slug.padEnd(34)} ${t.industry.padEnd(16)} → ${t.pair}`);
      ok += 1;
    } catch (e: any) {
      console.warn(`  ⚠ ${t.slug}: ${e?.message ?? e}`);
    }
  }
  console.log(`\n✅ ${ok}/${batch.length} updated. ${todo.length - ok} remain.`);
  console.log('⚠️  Published sites keep serving their old snapshot until they are re-published.');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
