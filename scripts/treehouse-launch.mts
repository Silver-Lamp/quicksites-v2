// scripts/treehouse-launch.mts
//
// Build and publish the treehouse cohort: the national hub plus one page per state that clears
// the coverage bar (docs/TREEHOUSE_COHORT.md). Idempotent — a domain whose campaign already
// exists is skipped, so a re-run after a partial failure finishes the job rather than duplicating.
//
//   npx tsx --env-file=.env.local scripts/treehouse-launch.mts          # dry run
//   npx tsx --env-file=.env.local scripts/treehouse-launch.mts --apply
//
// ⚠️ Refuses to publish a state page below the coverage bar. That check lives here AND in the
// registry because the failure it prevents — a directory page with nothing on it — is the one
// that damages trust with the businesses we list.

// @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
import ws from 'ws';
(globalThis as any).WebSocket ??= ws;

import { randomUUID } from 'node:crypto';

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
  const { createGeoCampaign } = await import('@/lib/outreach/geoCampaigns');
  const { addProjectDomain } = await import('@/lib/domains/vercel');

  const jobs: Array<{ domain: string; city: string; code: string; site: any }> = [
    { domain: HUB, city: 'United States', code: 'US', site: buildHubSite({ domain: HUB }) },
  ];
  for (const s of STATES) {
    const cov = stateCoverage(s.code);
    if (cov < MIN_COVERAGE) {
      console.log(`${s.domain}: coverage ${cov} < ${MIN_COVERAGE} — REFUSED (a page with nothing on it)`);
      continue;
    }
    jobs.push({
      domain: s.domain,
      city: s.state,
      code: s.code,
      site: buildStateSite({ state: s.state, stateCode: s.code, domain: s.domain }),
    });
  }

  for (const job of jobs) {
    const { data: existing } = await supabaseAdmin
      .from('geo_industry_campaigns')
      .select('id')
      .eq('domain', job.domain)
      .maybeSingle();
    if (existing) {
      console.log(`${job.domain}: campaign exists (${existing.id.slice(0, 8)}) — skip`);
      continue;
    }
    const entries = job.site.data.pages[0].blocks.find((b: any) => b.type === 'builders_directory')
      ?.content.entries.length ?? 0;
    console.log(`${job.domain}: ${entries} entries${APPLY ? '' : ' (dry run)'}`);
    if (!APPLY) continue;

    const id = randomUUID();
    const { error: tErr } = await supabaseAdmin.from('templates').insert({
      id,
      template_name: job.site.businessName,
      slug: job.site.slug,
      data: job.site.data,
      color_mode: job.site.color_mode,
      header_block: job.site.header_block,
      footer_block: job.site.footer_block,
      is_site: false,
      industry: 'treehouse_builder',
      business_name: job.site.businessName,
      owner_id: OPERATOR_ID,
      claim_source: 'directory',
    });
    if (tErr) {
      console.error(`${job.domain}: template insert failed: ${tErr.message}`);
      continue;
    }
    let domainStatus = 'registered';
    try {
      await addProjectDomain(job.domain);
      await addProjectDomain(`www.${job.domain}`);
      domainStatus = 'attached';
    } catch (e: any) {
      console.warn(`${job.domain}: attach failed: ${e?.message}`);
    }
    const campaign = await createGeoCampaign({
      city: job.city,
      region: job.code,
      country: 'US',
      industryKey: 'treehouse_builder',
      domain: job.domain,
      slug: job.site.slug,
      templateId: id,
      domainStatus,
      createdBy: OPERATOR_ID,
      orgId: null,
    });
    const { error: pErr } = await (supabaseAdmin as any).rpc('publish_template_demo', {
      p_template_id: id,
    });
    console.log(
      `${job.domain}: template ${id.slice(0, 8)} campaign ${campaign.id.slice(0, 8)} domain=${domainStatus} publish=${pErr ? 'FAILED ' + pErr.message : 'ok'}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
