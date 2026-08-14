/**
 * scripts/regenerate-people-heroes.ts
 *
 * Replace a published site's hero image with a freshly generated, people-free one.
 *
 * ⚠️ THIS SPENDS REAL MONEY — one gpt-image-1 render per site, ~$0.04 each. It is therefore
 * DRY-RUN BY DEFAULT and takes an explicit slug list. There is deliberately no `--all`: the
 * whole reason this script exists is that a sweep found 16 old heroes with people in them and
 * only some of them are worth paying to replace. A flag that regenerates everything would spend
 * on the ones already clean, which is exactly the "paid for a no-op and reported it as a fix"
 * failure recorded in generateDemoSite.ts.
 *
 * Rule 9 (lib/images/noPeople.ts) is enforced by `generateHero` itself — this script does not
 * write its own prompt, so it cannot drift from the standard.
 *
 *   npx tsx scripts/regenerate-people-heroes.ts <slug> [<slug>...]            # dry run
 *   npx tsx scripts/regenerate-people-heroes.ts --apply <slug> [<slug>...]    # spends
 */
import dotenv from 'dotenv';
// Load env BEFORE any lib import (supabaseAdmin + the AI pricing table read env at module
// construction) — hence the dynamic imports in main(), mirroring regenerate-listing-copy.ts.
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '../../../.env.local' }); // when run from a worktree
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const SLUGS = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const COST_EACH_USD = 0.04;

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );
}

/** The hero block on the first page, whichever of the two shapes it uses. */
function findHero(data: any): { block: any; field: 'image_url' | 'heroImage' } | null {
  for (const page of data?.pages ?? []) {
    for (const b of page?.content_blocks ?? []) {
      if (b?.type !== 'hero') continue;
      if (b?.content && 'image_url' in b.content) return { block: b, field: 'image_url' };
      if (b?.props && 'heroImage' in b.props) return { block: b, field: 'heroImage' };
      if (b?.content) return { block: b, field: 'image_url' };
    }
  }
  return null;
}

async function main() {
  const { generateHero } = await import('@/lib/builder/generateDemoSite');
  const { commitTemplatePatch } = await import('@/lib/templates/commitTemplatePatch');

  if (!SLUGS.length) {
    console.error('Pass one or more template slugs. Nothing is regenerated without them.');
    process.exit(1);
  }

  const db = admin();
  const { data: rows, error } = await db
    .from('templates')
    .select('id, slug, data, rev, published, claim_source, template_name')
    .in('slug', SLUGS);
  if (error) throw error;

  const found = rows ?? [];
  const missing = SLUGS.filter((s) => !found.some((r: any) => r.slug === s));
  if (missing.length) console.warn(`⚠️  not found: ${missing.join(', ')}`);

  console.log(
    `${APPLY ? 'APPLYING' : 'DRY RUN'} — ${found.length} site(s), ` +
      `est. $${(found.length * COST_EACH_USD).toFixed(2)}${APPLY ? '' : ' if applied'}\n`,
  );

  for (const row of found as any[]) {
    const data = row.data ?? {};
    const hero = findHero(data);
    if (!hero) {
      console.log(`· ${row.slug}: no hero block — skipped`);
      continue;
    }
    const before = hero.block.content?.image_url || hero.block.props?.heroImage || '(none)';
    const meta = data?.meta ?? {};
    // ⚠️ NEVER fall back to the hero HEADLINE for the business name. It is marketing copy, and
    // on the first dry run it produced businessName "Revitalize Your Carpets Today" — which
    // would have been fed to an image model as the name of the business and rendered onto
    // signage. `templates.template_name` is the actual name; the slug is the last resort.
    const spec = {
      businessName:
        data?.business_name || meta?.business_name || row.template_name || row.slug,
      industryLabel: meta?.industry_label || data?.industry || meta?.industry || 'local business',
      city: data?.contact?.city || meta?.city || '',
      state: data?.contact?.state || meta?.state || '',
    } as any;

    console.log(`· ${row.slug}`);
    console.log(`    business : ${spec.businessName} — ${spec.industryLabel} (${spec.city}${spec.state ? ', ' + spec.state : ''})`);
    console.log(`    before   : ${String(before).slice(-56)}`);
    if (!APPLY) {
      console.log('    action   : would generate a people-free hero and republish\n');
      continue;
    }

    const url = await generateHero(spec, null);
    if (!url) {
      console.log('    ✗ generation failed — site left untouched\n');
      continue;
    }
    if (hero.field === 'image_url') {
      hero.block.content = { ...(hero.block.content ?? {}), image_url: url };
    } else {
      hero.block.props = { ...(hero.block.props ?? {}), heroImage: url };
    }

    const err = await commitTemplatePatch(row.id, row.rev ?? 0, { data }, null);
    if (err) {
      console.log(`    ✗ commit failed: ${err}\n`);
      continue;
    }
    // The public render serves the PUBLISHED snapshot, not templates.data — without this the
    // new hero exists in the editor and the live site keeps showing the old one.
    const { error: pErr } = await (db as any).rpc('publish_template_demo', { p_template_id: row.id });
    console.log(`    after    : ${url.slice(-56)}`);
    console.log(pErr ? `    ⚠️  committed but republish failed: ${pErr.message}\n` : '    ✓ committed + republished\n');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
