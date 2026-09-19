// scripts/dome-builders-launch.mts
//
// Launch the <state>domebuilders.com directory sites (docs/PPL_VERTICAL.md §9; DomeSketch
// proposal 2026-09-19). For each state: sweep Google Places for dome builders IN the state,
// keep only what looks like a builder (never a glamping rental, a stadium, a conservatory),
// add DomeSketch's directory entries whose regions name the state, build the directory site
// (lib/domeBuilders/buildDirectorySite), insert the template, attach the domain to the Vercel
// project, record the campaign, publish.
//
//   npx tsx scripts/dome-builders-launch.mts            # dry run: prints what it would build
//   npx tsx scripts/dome-builders-launch.mts --apply    # writes
//
// Idempotent: a state whose campaign already exists is skipped. Every entry carries a source
// (the Google Maps listing, or DomeSketch's own sources[]). Node 20: the ws polyfill must land
// before the admin client is imported (CLAUDE.md §5b render workers note).

// @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
import ws from 'ws';
(globalThis as any).WebSocket ??= ws;

import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const APPLY = process.argv.includes('--apply');
const OPERATOR_ID = 'fbde34ec-16e7-4dfe-94b5-ca2cc4d448d2';
const DOMESKETCH_ORGS = '/Users/sandonjurowski/Desktop/_SilverLamp/domesketch/data/orgs.json';

const STATES: Array<{ state: string; code: string }> = [
  { state: 'Texas', code: 'TX' },
  { state: 'California', code: 'CA' },
  { state: 'Florida', code: 'FL' },
  { state: 'Oregon', code: 'OR' },
  { state: 'Idaho', code: 'ID' },
  { state: 'Illinois', code: 'IL' },
  { state: 'Michigan', code: 'MI' },
  { state: 'Minnesota', code: 'MN' },
  { state: 'Missouri', code: 'MO' },
  { state: 'Wisconsin', code: 'WI' },
  { state: 'North Carolina', code: 'NC' },
  { state: 'Arizona', code: 'AZ' },
  { state: 'Utah', code: 'UT' },
];

// Words that mean "not a builder" when they appear in a Places result's name.
// Businesses with "dome" in the name that are not dome BUILDERS: rentals, landmarks, and other
// trades (ADA truncated-dome tiles, dome ceilings, a flooring contractor called Dome).
const NOT_A_BUILDER =
  /glamp|resort|retreat|rental|airbnb|\bstay\b|cabin|\bpark\b|conservatory|stadium|bank|for sale|church|museum|roofing|coffee|cafe|restaurant|hotel|lodge|campground|university|co-op|coop|tour|flooring|ceiling|landscape|truncated|stargaz|experience|luxury|ranch|buckminster|baggin|institute|elevation/i;
const BUILDER_WORD = /dome|geodesic|monolithic|aircrete|earthbag/i;

type Entry = {
  name: string;
  city?: string;
  region?: string;
  phone?: string;
  website?: string;
  summary?: string;
  kinds?: string[];
  source_label?: string;
  source_url?: string;
};

function kindsFor(name: string, summary = ''): string[] {
  const t = `${name} ${summary}`.toLowerCase();
  const k: string[] = [];
  if (t.includes('monolithic')) k.push('Monolithic');
  if (t.includes('geodesic')) k.push('Geodesic');
  if (t.includes('aircrete')) k.push('AirCrete');
  if (t.includes('kit')) k.push('Kits');
  if (!k.length) k.push('Dome builder');
  return k;
}

async function placesSweep(state: string, code: string): Promise<Entry[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY!;
  const out = new Map<string, Entry>();
  for (const q of [
    `geodesic dome home builder in ${state}`,
    `dome home contractor in ${state}`,
    `monolithic dome builder in ${state}`,
  ]) {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask':
          'places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.googleMapsUri,places.addressComponents',
      },
      body: JSON.stringify({ textQuery: q, pageSize: 20 }),
    });
    const j = (await res.json()) as any;
    for (const p of j.places ?? []) {
      const name: string = p.displayName?.text ?? '';
      const addr: string = p.formattedAddress ?? '';
      if (!name || !BUILDER_WORD.test(name) || NOT_A_BUILDER.test(name)) continue;
      if (!new RegExp(`\\b${code}\\b`).test(addr)) continue; // in-state only
      const city =
        (p.addressComponents ?? []).find((c: any) => (c.types ?? []).includes('locality'))
          ?.longText ?? '';
      // De-duplicate near-identical listings ("Pacific Domes" / "Pacific Domes Inc").
      const key = name
        .toLowerCase()
        .replace(/\b(inc|llc|corp|corporation|co|company)\b\.?/g, '')
        .replace(/[^a-z]/g, '');
      if ([...out.keys()].some((k) => k === key)) continue;
      out.set(key, {
        name,
        city,
        region: code,
        phone: p.nationalPhoneNumber ?? '',
        website: p.websiteUri ?? '',
        kinds: kindsFor(name),
        source_label: 'Google Maps listing',
        source_url: p.googleMapsUri ?? '',
      });
    }
  }
  return [...out.values()];
}

function domesketchEntries(code: string): Entry[] {
  const orgs = JSON.parse(readFileSync(DOMESKETCH_ORGS, 'utf8')) as any[];
  return orgs
    .filter(
      (o) =>
        (o.regions ?? []).includes(`US-${code}`) && Array.isArray(o.sources) && o.sources.length
    )
    .map((o) => {
      const src = o.sources[0];
      const kinds = [...(o.categories ?? [])]
        .map((c: string) => c.replace(/-/g, ' '))
        .map((c) => c[0].toUpperCase() + c.slice(1));
      return {
        name: o.name,
        region: code,
        website: o.url ?? '',
        summary: o.summary ?? '',
        kinds,
        source_label: `DomeSketch directory${src?.label ? ` · ${src.label}` : ''}`,
        source_url: typeof src === 'string' ? src : (src?.url ?? o.url ?? ''),
      } as Entry;
    });
}

async function main() {
  const { supabaseAdmin } = await import('@/lib/supabase/admin');
  const { buildDirectorySite, entryIsClean } = await import(
    '@/lib/domeBuilders/buildDirectorySite'
  );
  const { createGeoCampaign } = await import('@/lib/outreach/geoCampaigns');
  const { addProjectDomain } = await import('@/lib/domains/vercel');

  for (const { state, code } of STATES) {
    const domain = `${state.toLowerCase().replace(/[^a-z]/g, '')}domebuilders.com`;
    const { data: existing } = await supabaseAdmin
      .from('geo_industry_campaigns')
      .select('id')
      .eq('domain', domain)
      .maybeSingle();
    if (existing) {
      console.log(`${domain}: campaign exists (${existing.id}) — skip`);
      continue;
    }
    const fromDs = domesketchEntries(code);
    const norm = (n: string) =>
      n
        .toLowerCase()
        .replace(/\b(inc|llc|corp|corporation|co|company)\b\.?/g, '')
        .replace(/[^a-z]/g, '');
    const fromPlaces = (await placesSweep(state, code)).filter(
      (e) => !fromDs.some((d) => norm(d.name) === norm(e.name))
    );
    const entries = [...fromDs, ...fromPlaces].filter(entryIsClean);
    const calculatorUrl = `https://domesketch.ai/?utm_source=${domain}&utm_medium=directory&utm_campaign=dome_builders`;
    const site = buildDirectorySite({ state, stateCode: code, domain, entries, calculatorUrl });
    console.log(
      `${domain}: ${entries.length} entries (${fromDs.length} DomeSketch, ${fromPlaces.length} Places) — ${entries.map((e) => e.name).join('; ')}`
    );
    if (!APPLY) continue;

    const id = randomUUID();
    const { error: tErr } = await supabaseAdmin.from('templates').insert({
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
    if (tErr) {
      console.error(`${domain}: template insert failed: ${tErr.message}`);
      continue;
    }
    let domainStatus = 'registered';
    try {
      await addProjectDomain(domain);
      await addProjectDomain(`www.${domain}`);
      domainStatus = 'attached';
    } catch (e: any) {
      console.warn(`${domain}: attach failed: ${e?.message}`);
    }
    const campaign = await createGeoCampaign({
      city: state,
      region: code,
      country: 'US',
      industryKey: 'dome_builder',
      domain,
      slug: site.slug,
      templateId: id,
      domainStatus,
      createdBy: OPERATOR_ID,
      orgId: null,
    });
    const { error: pErr } = await (supabaseAdmin as any).rpc('publish_template_demo', {
      p_template_id: id,
    });
    console.log(
      `${domain}: template ${id.slice(0, 8)} campaign ${campaign.id.slice(0, 8)} domain=${domainStatus} publish=${pErr ? 'FAILED ' + pErr.message : 'ok'}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
