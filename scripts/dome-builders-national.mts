// scripts/dome-builders-national.mts
//
// Launch the two national dome pages and point the remaining national domains at the chooser:
//   geodesicdomebuilders.com  → kit makers + suppliers (DomeSketch orgs with sources)
//   domebuildersnearme.com    → state chooser (links every live <state>domebuilders.com)
//   dome-builders.com, monolithicdomebuilders.com, domecontractors.com, domehomecontractors.com,
//   geodesicdomecontractors.com, finddomebuilders.com → 308 to domebuildersnearme.com
//
//   npx tsx scripts/dome-builders-national.mts            # dry run
//   npx tsx scripts/dome-builders-national.mts --apply
//
// Domain attach uses the Vercel CLI's own token (~/Library/Application Support/com.vercel.cli/
// auth.json) because the VERCEL_TOKEN in .env.local is not authorised for project-domain writes.

// @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
import ws from 'ws';
(globalThis as any).WebSocket ??= ws;

import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

const APPLY = process.argv.includes('--apply');
const OPERATOR_ID = 'fbde34ec-16e7-4dfe-94b5-ca2cc4d448d2';
const KIT = 'geodesicdomebuilders.com';
const CHOOSER = 'domebuildersnearme.com';
const REDIRECTS = [
  'dome-builders.com',
  'monolithicdomebuilders.com',
  'domecontractors.com',
  'domehomecontractors.com',
  'geodesicdomecontractors.com',
  'finddomebuilders.com',
];

function vercelAuth() {
  const token = JSON.parse(
    readFileSync(join(homedir(), 'Library/Application Support/com.vercel.cli/auth.json'), 'utf8')
  ).token as string;
  const proj = JSON.parse(readFileSync('.vercel/project.json', 'utf8')) as {
    orgId: string;
    projectId: string;
  };
  return { token, team: proj.orgId, project: proj.projectId };
}

async function attach(name: string, redirectTo?: string) {
  const { token, team, project } = vercelAuth();
  const body: Record<string, unknown> = { name };
  if (redirectTo) {
    body.redirect = redirectTo;
    body.redirectStatusCode = 308;
  }
  const r = await fetch(`https://api.vercel.com/v10/projects/${project}/domains?teamId=${team}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (r.ok) return 'attached';
  const t = await r.text();
  if (/already|domain_already_in_use/i.test(t)) {
    if (redirectTo) {
      // Already attached: set the redirect with PATCH.
      const p = await fetch(
        `https://api.vercel.com/v9/projects/${project}/domains/${name}?teamId=${team}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ redirect: redirectTo, redirectStatusCode: 308 }),
        }
      );
      return p.ok ? 'redirect-updated' : `redirect-failed ${p.status}`;
    }
    return 'already';
  }
  return `failed ${r.status} ${t.slice(0, 100)}`;
}

async function main() {
  const { supabaseAdmin } = await import('@/lib/supabase/admin');
  const { buildKitMakersSite, buildStateChooserSite } = await import(
    '@/lib/domeBuilders/buildNationalSites'
  );
  const { createGeoCampaign } = await import('@/lib/outreach/geoCampaigns');

  // State links + counts from the live campaigns/templates.
  const { data: campaigns } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, domain, city, template_id')
    .eq('industry_key', 'dome_builder')
    .like('domain', '%domebuilders.com');
  const states: Array<{ state: string; domain: string; count: number }> = [];
  for (const c of campaigns ?? []) {
    if (c.domain === KIT || c.domain === CHOOSER) continue;
    const { data: t } = await supabaseAdmin
      .from('templates')
      .select('data')
      .eq('id', c.template_id)
      .maybeSingle();
    const dir = (t?.data?.pages?.[0]?.blocks ?? []).find(
      (b: any) => b?.type === 'builders_directory'
    );
    states.push({ state: c.city, domain: c.domain, count: dir?.content?.entries?.length ?? 0 });
  }
  const { fetchDomesketchFeed, calculatorUrl: utm } = await import(
    '@/lib/domeBuilders/domesketchFeed'
  );
  const orgs = (await fetchDomesketchFeed()).orgs;
  const kit = buildKitMakersSite({ domain: KIT, orgs, calculatorUrl: utm(KIT), states });
  const chooser = buildStateChooserSite({
    domain: CHOOSER,
    states,
    kitMakersDomain: KIT,
    calculatorUrl: utm(CHOOSER),
  });
  console.log(
    `${KIT}: ${kit.entries.length} kit makers/suppliers — ${kit.entries.map((e) => e.name).join('; ')}`
  );
  console.log(
    `${CHOOSER}: ${states.length} states — ${states.map((s) => `${s.state} (${s.count})`).join(', ')}`
  );
  console.log(`redirects → ${CHOOSER}: ${REDIRECTS.join(', ')}`);
  if (!APPLY) return;

  for (const site of [kit, chooser]) {
    const { data: existing } = await supabaseAdmin
      .from('geo_industry_campaigns')
      .select('id')
      .eq('domain', site.domain)
      .maybeSingle();
    if (existing) {
      console.log(`${site.domain}: campaign exists — skip`);
      continue;
    }
    const id = randomUUID();
    const { error } = await supabaseAdmin.from('templates').insert({
      id,
      template_name: site.businessName,
      slug: site.slug,
      data: site.data,
      color_mode: site.color_mode,
      header_block: site.header_block,
      footer_block: site.footer_block,
      is_site: false,
      industry: 'dome_builder',
      business_name: site.businessName,
      owner_id: OPERATOR_ID,
      claim_source: 'directory',
    });
    if (error) {
      console.error(`${site.domain}: insert failed ${error.message}`);
      continue;
    }
    const a1 = await attach(site.domain);
    const a2 = await attach(`www.${site.domain}`);
    const campaign = await createGeoCampaign({
      city: 'United States',
      region: 'US',
      country: 'US',
      industryKey: 'dome_builder',
      domain: site.domain,
      slug: site.slug,
      templateId: id,
      domainStatus: a1 === 'attached' || a1 === 'already' ? 'attached' : 'registered',
      createdBy: OPERATOR_ID,
      orgId: null,
    });
    const { error: pErr } = await (supabaseAdmin as any).rpc('publish_template_demo', {
      p_template_id: id,
    });
    console.log(
      `${site.domain}: template ${id.slice(0, 8)} campaign ${campaign.id.slice(0, 8)} attach=${a1}/${a2} publish=${pErr ? 'FAILED ' + pErr.message : 'ok'}`
    );
  }
  for (const d of REDIRECTS) {
    const r1 = await attach(d, CHOOSER);
    const r2 = await attach(`www.${d}`, CHOOSER);
    console.log(`${d}: ${r1} / www ${r2}`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
