// scripts/dome-builders-apply-referrals.mts
//
// Push the ACTIVE referral links (lib/domeBuilders/referralPrograms.ts) onto every dome-builders
// directory page and republish. Run after Sandon supplies a program's link and the registry
// entry is set to status 'active'. Walks ALL three content copies (CLAUDE.md §8) and commits
// through the sanctioned RPC. Idempotent; a page with nothing to change is left alone.
//
//   npx tsx scripts/dome-builders-apply-referrals.mts            # dry run
//   npx tsx scripts/dome-builders-apply-referrals.mts --apply

// @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
import ws from 'ws';
(globalThis as any).WebSocket ??= ws;

const APPLY = process.argv.includes('--apply');
const OPERATOR_ID = 'fbde34ec-16e7-4dfe-94b5-ca2cc4d448d2';

async function main() {
  const { supabaseAdmin } = await import('@/lib/supabase/admin');
  const { applyReferrals, REFERRAL_PROGRAMS } = await import('@/lib/domeBuilders/referralPrograms');
  const { commitTemplatePatch } = await import('@/lib/templates/commitTemplatePatch');
  const active = REFERRAL_PROGRAMS.filter((p) => p.status === 'active' && p.affiliateUrl);
  console.log(
    `active programs: ${active.length}${active.length ? ' — ' + active.map((p) => p.org).join(', ') : ''}`
  );

  const { data: campaigns } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, domain, template_id')
    .eq('industry_key', 'dome_builder');
  for (const c of campaigns ?? []) {
    const { data: t } = await supabaseAdmin
      .from('templates')
      .select('id, data, rev')
      .eq('id', c.template_id)
      .maybeSingle();
    if (!t) continue;
    const data = JSON.parse(JSON.stringify(t.data));
    let changed = 0;
    for (const page of data.pages ?? []) {
      for (const arr of [page.blocks, page.content_blocks]) {
        for (const b of arr ?? []) {
          if (b?.type !== 'builders_directory') continue;
          for (const holder of [b.content, b.props]) {
            if (!holder || !Array.isArray(holder.entries)) continue;
            const next = applyReferrals(holder.entries);
            if (JSON.stringify(next) !== JSON.stringify(holder.entries)) {
              holder.entries = next;
              changed++;
            }
          }
        }
      }
    }
    if (!changed) {
      console.log(`${c.domain}: no change`);
      continue;
    }
    console.log(`${c.domain}: ${changed} block copies updated${APPLY ? '' : ' (dry run)'}`);
    if (!APPLY) continue;
    // commit_template takes a patch against the current rev; `data` is the whole tree here.
    await commitTemplatePatch(t.id, Number((t as any).rev ?? 0), { data }, OPERATOR_ID);
    const { error } = await (supabaseAdmin as any).rpc('publish_template_demo', {
      p_template_id: t.id,
    });
    console.log(`${c.domain}: republished ${error ? 'FAILED ' + error.message : 'ok'}`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
