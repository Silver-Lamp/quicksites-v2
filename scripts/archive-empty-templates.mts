// scripts/archive-empty-templates.mts
//
// Archive templates that have no pages — duplicate/version artifacts from bulk processes, not
// anybody's work.
//
//   npx tsx scripts/archive-empty-templates.mts                   # dry run, writes nothing
//   npx tsx scripts/archive-empty-templates.mts --apply --limit 25
//   npx tsx scripts/archive-empty-templates.mts --restore --limit 25   # undo
//
// ⚠️ ARCHIVE, NEVER DELETE. `templates.archived` already exists and the admin list already
// filters `.eq('archived', false)`, so a flag buys the entire benefit at none of the cost. The
// thing a DELETE cannot survive is discovering that some *other* query joins templates without
// filtering `archived` — a flag lets you flip it back, 1,199 deleted rows do not.
//
// Measured before writing anything (2026-10-02): of 1,199 templates with zero pages —
//   published .................. 0
//   real custom_domain ......... 0   (368 looked like domains; all were EMPTY STRINGS)
//   in geo_industry_campaigns .. 0
//   in published_sites ......... 0
//   distinct owners ............ 4   (operator accounts, not customers)
//   with the `-xxxx` suffix .. 1,188  (the builder's random-variant shape)
//
// ⚠️ EVERY ONE OF THOSE IS RE-CHECKED PER ROW AT WRITE TIME. The survey above is a snapshot;
// a row could gain a domain or get published between the count and the write. A bulk job that
// trusts its own earlier count is how a live site gets archived.
//
// ⚠️ Writes go through the sanctioned guard bypass inside a transaction — a direct UPDATE
// raises "Direct updates to templates are blocked. Use app.commit_template()". `archived` is
// not content, so commit_template is the wrong tool; the bypass is the documented path for
// one-off non-content work (CLAUDE.md §8).

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { execFileSync } from 'node:child_process';

const APPLY = process.argv.includes('--apply');
const RESTORE = process.argv.includes('--restore');
const LIMIT = Number(process.argv[process.argv.indexOf('--limit') + 1]) || 25;
const CONN = process.env.SUPABASE_DB_URL;
if (!CONN) throw new Error('SUPABASE_DB_URL is required');

/** Exactly the population this script may touch. Used for the survey AND each write. */
const SAFE_PREDICATE = `
  coalesce(jsonb_array_length(coalesce(data->'pages','[]'::jsonb)), 0) = 0
  and coalesce(published, false) = false
  and btrim(coalesce(custom_domain, '')) = ''
  and id not in (select template_id from geo_industry_campaigns where template_id is not null)
  and id not in (select template_id from published_sites where template_id is not null)
`;

function sql(q: string): string {
  return execFileSync('psql', [CONN!, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', q], {
    encoding: 'utf8',
  }).trim();
}

function main() {
  if (RESTORE) {
    const n = Number(sql(`select count(*) from templates where archived = true and ${SAFE_PREDICATE}`));
    console.log(`\n${n} archived empty template(s) could be restored.`);
    if (!APPLY) return console.log('Add --apply to restore.\n');
    const done = sql(`
      begin;
      select set_config('app.bypass_template_guard','on', true);
      with pick as (select id from templates where archived = true and ${SAFE_PREDICATE} limit ${LIMIT})
      update templates t set archived = false from pick where t.id = pick.id;
      commit;
      select count(*) from templates where archived = true and ${SAFE_PREDICATE};`);
    return console.log(`Restored. ${done.split('\n').pop()} still archived.\n`);
  }

  const total = Number(sql(`select count(*) from templates where ${SAFE_PREDICATE} and coalesce(archived,false) = false`));
  const guarded = Number(sql(`
    select count(*) from templates
    where coalesce(jsonb_array_length(coalesce(data->'pages','[]'::jsonb)),0) = 0
      and coalesce(archived,false) = false
      and not (${SAFE_PREDICATE.replace(/^\s*coalesce\(jsonb_array_length[^\n]*\n\s*and /, '')})`));

  console.log(`\n${total} empty template(s) eligible to archive.`);
  if (guarded > 0) {
    // Published, domain-bearing or referenced shells exist and are deliberately left alone.
    console.log(`⚠ ${guarded} empty template(s) are NOT eligible (published, domained or referenced) and stay put.`);
  }
  console.log(sql(`
    select '  ' || coalesce(nullif(slug,''),'(no slug)') || '   ' || created_at::date
    from templates where ${SAFE_PREDICATE} and coalesce(archived,false) = false
    order by created_at limit 8`));

  if (!APPLY) return console.log(`\nNothing written. Re-run with --apply --limit N.\n`);

  const before = total;
  sql(`
    begin;
    select set_config('app.bypass_template_guard','on', true);
    with pick as (
      select id from templates where ${SAFE_PREDICATE} and coalesce(archived,false) = false
      order by created_at limit ${LIMIT}
    )
    update templates t set archived = true from pick where t.id = pick.id;
    commit;`);
  const after = Number(sql(`select count(*) from templates where ${SAFE_PREDICATE} and coalesce(archived,false) = false`));
  console.log(`\n✅ archived ${before - after}. ${after} remain.`);
  console.log('   Undo with: npx tsx scripts/archive-empty-templates.mts --restore --apply --limit N\n');
}

main();
