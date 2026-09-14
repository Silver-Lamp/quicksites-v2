// scripts/launch-batch-city-apexes.ts
//
// Turn a city's batch-imported restaurant drafts into a restaurant competition with an apex
// directory at `<city>-restaurant.delivered.menu`.
//
//   npx tsx scripts/launch-batch-city-apexes.ts --city "Elizabeth" --state NJ [--dry-run]
//
// ⚠️ WHY THIS EXISTS. `scripts/import-listings-batch.ts` (the CedarSites batch) writes
// `listing_import` templates and NOTHING ELSE — no `outreach_prospects` row — so the cities it
// imported (Elizabeth 36, Naples 18, Union City 16, …) are invisible to every funnel surface:
// the Location Domains panel, `createRestaurantCompetition`, the directory hydrate. The apex
// needs a cohort of PROSPECTS linked to a campaign. This backfills the prospect row from the
// template's own listing data (name, phone, address, city, `source_place_id`) — facts the
// listing published, nothing inferred — then launches through the same
// `createRestaurantCompetition` the admin button calls.
//
// ⚠️ MONEY. Launching calls `provisionGeoDomain`, which checks availability (free) and registers
// ONLY under `GEO_DOMAIN_REGISTER_ENABLED`. This script refuses to run with that flag set, so a
// city apex never buys a domain by accident: the apex lives on the delivered.menu subdomain, and
// the .com is a separate, deliberate purchase.
//
// ⚠️ INVENTED MENUS. When the OCR found nothing, a draft still carries the food scaffold's
// placeholder menu under the real restaurant's name (#738). Such a draft stays IN the cohort (the
// contest is theirs to win) but is HIDDEN from the public directory via directoryCuration, so the
// apex never links a diner to a menu nobody wrote. The counts are printed; reversible per row.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

// supabase-js pulls in realtime, which needs a WebSocket global on Node < 22.
if (typeof (globalThis as any).WebSocket === 'undefined') {
  try {
    // @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
    const ws = (await import('ws')).default;
    (globalThis as any).WebSocket = ws;
  } catch {
    /* Node 22+ has a native WebSocket */
  }
}

const { supabaseAdmin } = await import('@/lib/supabase/admin');
const { createRestaurantCompetition } = await import('@/lib/outreach/restaurantCompetition');
const { geoDomainFor } = await import('@/lib/outreach/geoDomain');
const { hideTemplate } = await import('@/lib/outreach/directoryCuration');
const { readMenuSections, isPlaceholderOnly } = await import('@/lib/menu/menuBlocks');

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}
const CITY = (arg('city') ?? '').trim();
const STATE = (arg('state') ?? '').trim().toUpperCase();
const DRY = process.argv.includes('--dry-run');
const OPERATOR = (arg('operator') ?? process.env.LAUNCH_OPERATOR_ID ?? '').trim();

if (!CITY || !STATE) {
  console.error('usage: --city "<City>" --state <ST> [--operator <uuid>] [--dry-run]');
  process.exit(2);
}
if (!OPERATOR) {
  console.error('an operator user id is required (--operator or LAUNCH_OPERATOR_ID): the apex is owned by it');
  process.exit(2);
}
for (const flag of ['GEO_DOMAIN_REGISTER_ENABLED', 'VERCEL_DOMAIN_REGISTER_ENABLED']) {
  const v = (process.env[flag] ?? '').trim();
  if (v === '1' || v.toLowerCase() === 'true') {
    console.error(`refusing: ${flag} is on — this script must never buy a domain. Unset it and re-run.`);
    process.exit(2);
  }
}

const MENU_BASE = (process.env.NEXT_PUBLIC_MENU_BASE_DOMAIN || 'delivered.menu').trim();
const derived = geoDomainFor(CITY, 'restaurant');
console.log(`${CITY}, ${STATE} → apex slug ${derived.slug} (domain ${derived.domain}, not purchased)`);

// 1) The city's unclaimed batch drafts. Ownerless: an owned listing_import draft is somebody's.
const { data: rows, error } = await supabaseAdmin
  .from('templates')
  .select('id, slug, business_name, template_name, data, owner_id, claim_source')
  .eq('claim_source', 'listing_import')
  .is('owner_id', null)
  .filter('data->meta->contact->>city', 'eq', CITY)
  .filter('data->meta->contact->>state', 'eq', STATE);
if (error) throw new Error(error.message);
const drafts = (rows ?? []) as any[];
if (drafts.length < 2) {
  console.error(`only ${drafts.length} unclaimed listing_import drafts for ${CITY}, ${STATE} — a competition needs 2+`);
  process.exit(1);
}

// 2) A prospect row per draft: reuse one matching the listing's place id, else create it from
//    the draft's own listing facts. Nothing here is generated.
const prospectIds: string[] = [];
const placeholderTemplateIds: string[] = [];
let reused = 0, created = 0, skipped = 0;
for (const t of drafts) {
  const meta = t.data?.meta ?? {};
  const contact = meta.contact ?? {};
  const placeId: string | null = meta.source_place_id ?? null;
  const name: string = (t.business_name || meta.business_name || t.template_name || t.slug).trim();
  const sections = readMenuSections(t.data);
  const placeholder = sections.length > 0 && isPlaceholderOnly(sections);
  if (placeholder) placeholderTemplateIds.push(t.id);

  let prospectId: string | null = null;
  const { data: byTemplate } = await supabaseAdmin.from('outreach_prospects').select('id').eq('template_id', t.id).maybeSingle();
  if (byTemplate?.id) prospectId = byTemplate.id;
  if (!prospectId && placeId) {
    const { data: byPlace } = await supabaseAdmin
      .from('outreach_prospects').select('id, template_id').eq('place_id', placeId).maybeSingle();
    if (byPlace?.id && (!byPlace.template_id || byPlace.template_id === t.id)) {
      prospectId = byPlace.id;
      if (!DRY && !byPlace.template_id) {
        await supabaseAdmin.from('outreach_prospects')
          .update({ template_id: t.id, status: 'draft_built', updated_at: new Date().toISOString() }).eq('id', byPlace.id);
      }
      reused++;
    }
  }
  if (!prospectId && !placeId) {
    // `outreach_prospects.place_id` is NOT NULL: a prospect IS a listing. A draft with no listing
    // id (Seattle's came through a different path) cannot be enrolled without inventing one.
    console.log(`  SKIP  ${name} — ${t.slug}  (no listing place id; cannot be a prospect)`);
    skipped++;
    continue;
  }
  if (!prospectId) {
    created++;
    if (DRY) {
      prospectId = `dry:${t.id}`;
    } else {
      const { data: ins, error: insErr } = await supabaseAdmin
        .from('outreach_prospects')
        .insert({
          discovered_by: OPERATOR,
          place_id: placeId,
          source: 'listing_import_batch',
          business_name: name,
          phone: contact.phone ?? null,
          address: contact.address ?? null,
          city: CITY,
          region: STATE,
          industry_key: 'restaurant',
          categories: ['restaurant'],
          website: null,
          status: 'draft_built',
          template_id: t.id,
        })
        .select('id')
        .single();
      if (insErr) throw new Error(`prospect insert failed for ${t.slug}: ${insErr.message}`);
      prospectId = ins.id;
    }
  }
  if (!prospectId) throw new Error(`no prospect id for ${t.slug}`);
  prospectIds.push(prospectId);
  console.log(`  ${placeholder ? 'HIDE ' : '     '} ${name} — ${t.slug}${placeId ? '' : '  (no place id)'}`);
}
console.log(`cohort ${prospectIds.length}: ${reused} prospects reused, ${created} created, ${skipped} skipped (no place id); ${placeholderTemplateIds.length} placeholder-menu drafts to hide from the directory`);
if (prospectIds.length < 2) {
  console.error(`only ${prospectIds.length} enrollable drafts — a competition needs 2+`);
  process.exit(1);
}

if (DRY) { console.log('dry run — nothing written'); process.exit(0); }

// 3) Launch. Same function as the admin button.
const { campaign, cohortSize } = await createRestaurantCompetition({ prospectIds, createdBy: OPERATOR, region: STATE });
console.log(`campaign ${campaign.id} ${campaign.domain} domain_status=${campaign.domain_status} cohort=${cohortSize}`);

for (const id of placeholderTemplateIds) await hideTemplate(campaign.id, id, OPERATOR);
if (placeholderTemplateIds.length) console.log(`hid ${placeholderTemplateIds.length} placeholder-menu drafts from the directory`);

// 4) Read the served artifact, not the row.
const url = `https://${campaign.slug}.${MENU_BASE}/`;
const res = await fetch(url, { headers: { 'user-agent': 'quicksites-apex-launch' } });
const html = res.status === 200 ? await res.text() : '';
const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '';
const robots = html.match(/<meta name="robots" content="([^"]*)"/i)?.[1] ?? '(none)';
const links = new Set((html.match(/https?:\/\/[a-z0-9.-]+\.delivered\.menu/gi) ?? []).filter((h) => !h.includes(campaign.slug)));
console.log(`${url} → ${res.status} "${title}" robots=${robots} restaurants linked=${links.size}`);
if (res.status !== 200) { console.error('⚠️ the apex does not serve yet — check the publish (publish_template_demo) and the wildcard host'); process.exit(3); }
