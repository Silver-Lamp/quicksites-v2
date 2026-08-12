// scripts/strip-invented-menus.ts
//
// Remove the food scaffold's invented dishes from live listing-import drafts.
//
//   npx tsx --env-file=.env.local scripts/strip-invented-menus.ts          # dry run
//   npx tsx --env-file=.env.local scripts/strip-invented-menus.ts --write
//
// ⚠️ WHAT THIS IS CLEANING UP. `assembleDraft` only REPLACED the scaffold's placeholder menu when a
// real one was recovered from listing photos. Recovery runs ~50%, so the other half went live with
// "Two Eggs Any Style", "Buttermilk Pancakes" and "House Burger" listed under a real business's real
// name and address, on a page publicly reachable at its own URL. 28 of 59 drafts across two cities.
// The generator is fixed; these rows predate the fix.
//
// ⚠️ Templates cannot be UPDATEd directly — `app.guard_templates_update` blocks it. Writes go
// through commitTemplatePatch (the sanctioned commit_template RPC) with the row's real `rev`.
import { createClient } from '@supabase/supabase-js';
import { clearInventedMenu, readMenuSections, isPlaceholderOnly } from '../lib/menu/menuBlocks';
import { commitTemplatePatch } from '../lib/templates/commitTemplatePatch';

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Need NEXT_PUBLIC_SUPABASE_URL + service-role key.');
  return createClient(url, key);
}

async function main() {
  const write = process.argv.includes('--write');
  const s = db();
  const { data, error } = await s
    .from('templates')
    .select('id,slug,template_name,data,rev')
    .eq('claim_source', 'listing_import');
  if (error) throw new Error(error.message);

  const poisoned = (data ?? []).filter((t: any) => {
    const secs = readMenuSections(t.data);
    return secs.length > 0 && isPlaceholderOnly(secs);
  });

  console.log(`${data?.length} listing_import drafts · ${poisoned.length} showing invented dishes\n`);

  let done = 0;
  for (const t of poisoned as any[]) {
    // Deep-clone so a failed commit cannot leave a half-edited object behind.
    const next = JSON.parse(JSON.stringify(t.data ?? {}));
    let changed = false;
    for (const page of next.pages ?? []) {
      for (const key of ['content_blocks', 'blocks'] as const) {
        if (Array.isArray(page[key]) && clearInventedMenu(page[key])) changed = true;
      }
    }
    if (!changed) {
      console.log(`  – ${t.slug}: nothing to clear (menu block shape unrecognised)`);
      continue;
    }
    if (!write) {
      console.log(`  · ${t.slug}  (${t.template_name})`);
      continue;
    }
    // Returns null on success, an error message otherwise.
    const err = await commitTemplatePatch(t.id, t.rev, { data: next }, null);
    console.log(err ? `  ✗ ${t.slug}: ${err}` : `  ✓ ${t.slug}`);
    if (!err) done++;
  }
  console.log(write ? `\ncleared ${done}/${poisoned.length}` : `\nDRY RUN — pass --write`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
