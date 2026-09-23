// scripts/treehouse-republish.mts
//
// Rebuild every live treehouse page from the registry and republish. Run after adding or
// correcting a builder in lib/treehouseBuilders/builders.ts — the pages carry a SNAPSHOT of the
// registry, so a change there reaches nobody until this runs.
//
//   npx tsx --env-file=.env.local scripts/treehouse-republish.mts          # dry run
//   npx tsx --env-file=.env.local scripts/treehouse-republish.mts --apply
//
// ⚠️ Refuses to republish a state page that has fallen below the coverage bar — the same check
// the launcher applies, because a page can lose entries as well as gain them.

// @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
import ws from 'ws';
(globalThis as any).WebSocket ??= ws;

const APPLY = process.argv.includes('--apply');
const OPERATOR_ID = 'fbde34ec-16e7-4dfe-94b5-ca2cc4d448d2';
const MIN_COVERAGE = 2;

const STATES: Array<{ state: string; code: string; domain: string }> = [
  { state: 'California', code: 'CA', domain: 'californiatreehousebuilders.com' },
  { state: 'North Carolina', code: 'NC', domain: 'northcarolinatreehousebuilders.com' },
  { state: 'Washington', code: 'WA', domain: 'washingtontreehousebuilders.com' },
];
const HUB = 'customtreehousebuilders.com';

async function main() {
  const { supabaseAdmin } = await import('@/lib/supabase/admin');
  const { buildHubSite, buildStateSite } = await import('@/lib/treehouseBuilders/buildHubSite');
  const { stateCoverage } = await import('@/lib/treehouseBuilders/builders');
  const { commitTemplatePatch } = await import('@/lib/templates/commitTemplatePatch');

  const jobs: Array<{ domain: string; site: any }> = [
    { domain: HUB, site: buildHubSite({ domain: HUB }) },
  ];
  for (const s of STATES) {
    const cov = stateCoverage(s.code);
    if (cov < MIN_COVERAGE) {
      console.log(`${s.domain}: coverage ${cov} < ${MIN_COVERAGE} — REFUSED`);
      continue;
    }
    jobs.push({ domain: s.domain, site: buildStateSite({ state: s.state, stateCode: s.code, domain: s.domain }) });
  }

  for (const job of jobs) {
    const { data: c } = await supabaseAdmin
      .from('geo_industry_campaigns')
      .select('template_id')
      .eq('domain', job.domain)
      .maybeSingle();
    if (!c?.template_id) {
      console.log(`${job.domain}: no campaign — skip`);
      continue;
    }
    const { data: t } = await supabaseAdmin
      .from('templates')
      .select('id, data, rev')
      .eq('id', c.template_id)
      .maybeSingle();
    if (!t) continue;

    const before = JSON.stringify((t.data as any)?.pages?.[0]?.blocks ?? []);
    const after = JSON.stringify(job.site.data.pages[0].blocks);
    const n = job.site.data.pages[0].blocks.find((b: any) => b.type === 'builders_directory')
      ?.content.entries.length ?? 0;
    if (before === after) {
      console.log(`${job.domain}: ${n} entries — unchanged`);
      continue;
    }
    console.log(`${job.domain}: ${n} entries — CHANGED${APPLY ? '' : ' (dry run)'}`);
    if (!APPLY) continue;
    await commitTemplatePatch(t.id, Number((t as any).rev ?? 0), { data: job.site.data }, OPERATOR_ID);
    const { error } = await (supabaseAdmin as any).rpc('publish_template_demo', { p_template_id: t.id });
    console.log(`${job.domain}: republished ${error ? 'FAILED ' + error.message : 'ok'}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
