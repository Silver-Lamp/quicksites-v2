// scripts/apply-pool-backdrop.ts
//
// Give an existing site a painterly backdrop from the shared pool — for free.
//
// The painterly style is the only backdrop that costs money (~$0.04/call, gpt-image-1). The
// pool exists precisely so sites don't each pay for one: lib/theme/backdropPool.ts keeps a
// small per-industry set in storage, and site CREATION already reads from it. Existing sites
// had no path to do the same — they could only be painted (billed) or left on CSS.
//
// This closes that gap. Same convention as app/api/templates/create/route.ts:
//   { style: 'painterly', url: <pool image>, intensity: 50, auto: true }
//
// `auto: true` matters. It marks the backdrop as fleet-managed rather than owner-chosen, so
// the free bulk CSS upgrade may still manage it — unlike a PAID painterly, which
// paintSiteBackdrop writes with `auto: false` specifically so a sweep can never overwrite
// something someone paid for.
//
//   npx tsx scripts/apply-pool-backdrop.ts <slug> [industryKey]            # dry run
//   npx tsx scripts/apply-pool-backdrop.ts <slug> [industryKey] --apply
//
// Spends nothing. If the pool is empty for that industry it says so and exits rather than
// falling through to the paid path — spending must always be an explicit, separate decision.
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const SLUG = args[0];
const INDUSTRY = args[1];

if (!SLUG) {
  console.error('usage: apply-pool-backdrop.ts <slug> [industryKey] [--apply]');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
if (!url || !serviceKey) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY');
  process.exit(1);
}
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'templates';

async function main() {
  const { data: tpl } = await db
    .from('templates')
    .select('id, slug, rev, industry, published, data')
    .eq('slug', SLUG)
    .maybeSingle();
  if (!tpl) {
    console.error(`no template with slug ${SLUG}`);
    process.exit(1);
  }

  const industry =
    INDUSTRY || (tpl as any).industry || (tpl as any).data?.meta?.industry || 'general';
  const prefix = `backdrops/pool/${String(industry).replace(/[^a-z0-9_-]/gi, '')}`;

  const { data: files } = await db.storage.from(BUCKET).list(prefix, { limit: 100 });
  const pngs = (files ?? []).filter((f) => f.name.endsWith('.png'));
  if (!pngs.length) {
    console.error(
      `Pool is empty for industry "${industry}" (${BUCKET}/${prefix}).\n` +
        `Not falling through to the paid painter — that is a separate, explicit decision.\n` +
        `Fill the pool via the backdrop-pool-fill cron, or paint this one site deliberately.`,
    );
    process.exit(1);
  }

  // Deterministic pick (first file) rather than random: a script you may re-run should give
  // the same answer twice, and the pool's own note says two sites sharing a backdrop is fine.
  const pick = pngs[0];
  const publicUrl = db.storage.from(BUCKET).getPublicUrl(`${prefix}/${pick.name}`).data?.publicUrl;
  if (!publicUrl) {
    console.error('could not resolve a public URL for the pool image');
    process.exit(1);
  }

  const current = (tpl as any).data?.meta?.backdrop ?? null;
  console.log(`site:     ${tpl.slug} (published: ${(tpl as any).published})`);
  console.log(`industry: ${industry}`);
  console.log(`pool:     ${pngs.length} image(s) available — using ${pick.name}`);
  console.log(`current:  ${current ? JSON.stringify(current) : '(none)'}`);
  console.log(`new:      { style: 'painterly', url: <pool>, intensity: 50, auto: true }`);

  // Refuse to clobber a PAID painterly. auto:false means someone spent money on it.
  if (current?.style === 'painterly' && current?.auto === false) {
    console.error('\nThis site has a PAID painterly backdrop (auto:false). Refusing to overwrite it.');
    process.exit(1);
  }

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to write. Costs nothing either way.');
    return;
  }

  const data = ((tpl as any).data ?? {}) as Record<string, any>;
  const next = {
    ...data,
    meta: {
      ...(data.meta ?? {}),
      backdrop: { style: 'painterly', url: publicUrl, intensity: 50, auto: true },
    },
  };

  const { commitTemplatePatch } = await import('../lib/templates/commitTemplatePatch');
  const err = await commitTemplatePatch(tpl.id, (tpl as any).rev ?? 0, { data: next }, null);
  if (err) {
    console.error(`commit failed: ${err}`);
    process.exit(1);
  }
  console.log('\n✅ committed.');

  // A published site serves a SNAPSHOT, not templates.data — without this the backdrop is
  // invisible on the live page. Guarded so it never takes an unpublished draft live.
  const { republishIfPublished } = await import('../lib/templates/republishIfPublished');
  const res = await republishIfPublished(tpl.id, (tpl as any).published);
  console.log(`republish: ${JSON.stringify(res)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
