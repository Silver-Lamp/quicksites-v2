// scripts/gsc-query-harvest.mts
//
// Run the GSC query harvest by hand and print what it found — the same read the nightly cron
// (/api/cron/gsc-query-harvest) performs, for when you want the answer now rather than tomorrow.
// Writes to `gsc_queries` (idempotent per window) and then prints the two lists worth reading:
// what our sites are actually found FOR, and the striking-distance queries.
//
//   npx tsx --env-file=.env.local scripts/gsc-query-harvest.mts
//   npx tsx --env-file=.env.local scripts/gsc-query-harvest.mts --dry   # read + print, no writes
//
// Node 20: the ws polyfill must land before the admin client is imported (CLAUDE.md §5b).

// @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
import ws from 'ws';
(globalThis as any).WebSocket ??= ws;

const DRY = process.argv.includes('--dry');
const short = (d: string) => d.replace(/^sc-domain:/, '').replace(/https?:\/\/(www\.)?/, '').replace(/\/$/, '');

async function main() {
  const { google } = await import('googleapis');
  const { supabaseAdmin } = await import('@/lib/supabase/admin');
  const { getValidOAuthClient } = await import('@/lib/gsc/getValidOAuthClient');
  const { defaultWindow, parseQueryRows, pickStrikingDistance, isSelfReferential } = await import(
    '@/lib/gsc/queryHarvest'
  );
  const { listAllProperties, distinctGrants } = await import('@/lib/gsc/listProperties');
  const { isNonCommercialPage, whyExcluded } = await import('@/lib/gsc/fleetScope');

  const { startDate, endDate } = defaultWindow();
  // Enumerate from the grants rather than from one row per domain: a property added in the GSC
  // console has no row, so it was invisible — see lib/gsc/listProperties.ts.
  const { data: toks } = await supabaseAdmin.from('gsc_tokens').select('domain, refresh_token');
  const grants = distinctGrants(toks ?? []);
  const { properties, failedGrants } = await listAllProperties(grants);
  console.log(
    `${grants.length} grant(s) → ${properties.length} readable propert${properties.length === 1 ? 'y' : 'ies'}` +
      `${failedGrants.length ? ` (${failedGrants.length} grant(s) failed)` : ''} · window ${startDate} → ${endDate}${DRY ? ' · DRY RUN' : ''}\n`,
  );

  type Row = { domain: string; q: string; page?: string; impr: number; pos: number; clicks: number };
  const all: Row[] = [];
  const striking: Row[] = [];
  let written = 0;
  let failed = 0;

  for (const prop of properties) {
    const domain = prop.siteUrl;
    try {
      const auth = await getValidOAuthClient(prop.viaGrant);
      const sc = google.searchconsole({ version: 'v1', auth });
      const res = await sc.searchanalytics.query({
        siteUrl: domain,
        requestBody: { startDate, endDate, dimensions: ['query', 'page'], rowLimit: 500 },
      });
      const rows = parseQueryRows(res.data.rows);
      if (!rows.length) continue;

      if (!DRY) {
        const { error } = await supabaseAdmin.from('gsc_queries').upsert(
          rows.map((r) => ({
            domain, query: r.query, page: r.page ?? '', clicks: r.clicks, impressions: r.impressions,
            ctr: r.ctr, position: r.position, start_date: startDate, end_date: endDate,
          })),
          { onConflict: 'domain,query,page,start_date,end_date' },
        );
        if (error) { console.warn(`  ! ${short(domain)}: ${error.message}`); failed++; continue; }
        written += rows.length;
      }
      for (const r of rows) all.push({ domain, q: r.query, page: r.page, impr: r.impressions, pos: r.position, clicks: r.clicks });
      for (const r of pickStrikingDistance(rows)) {
        if (!isSelfReferential(r.query, domain) && !isNonCommercialPage(r.page)) {
          striking.push({ domain, q: r.query, page: r.page, impr: r.impressions, pos: r.position, clicks: r.clicks });
        }
      }
    } catch (e) {
      failed++;
      console.warn(`  ! ${short(domain)}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const line = (r: Row) =>
    `${String(r.impr).padStart(5)} impr  pos ${String(r.pos).padStart(6)}  ${String(r.clicks).padStart(2)} clk  ${r.q}   [${short(r.domain)}]`;

  console.log(`domains with query data: ${new Set(all.map((r) => r.domain)).size} · rows ${DRY ? 'read' : 'written'}: ${DRY ? all.length : written} · failed: ${failed}`);
  // Excluded at READ, never at write: the rows stay, they just never enter a fleet average.
  const commercial = all.filter((r) => !isNonCommercialPage(r.page));
  const dropped = all.filter((r) => isNonCommercialPage(r.page));
  if (dropped.length) {
    const di = dropped.reduce((s2, r) => s2 + r.impr, 0);
    const ti = all.reduce((s2, r) => s2 + r.impr, 0) || 1;
    console.log(
      `\nExcluded from the fleet view: ${dropped.length} row(s), ${di} impressions (${Math.round((100 * di) / ti)}% of all).`,
    );
    for (const p2 of [...new Set(dropped.map((r) => r.page).filter(Boolean))]) {
      console.log(`  ${p2} — ${whyExcluded(p2)}`);
    }
  }
  console.log(`\n=== What we are actually found for (top 25 by impressions, fleet only)`);
  [...commercial].sort((a, b) => b.impr - a.impr).slice(0, 25).forEach((r) => console.log(line(r)));
  console.log(`\n=== Striking distance — pos 11-40, >=10 impressions, self-lookups excluded (${striking.length})`);
  [...striking].sort((a, b) => b.impr - a.impr).slice(0, 25).forEach((r) => console.log(line(r)));
  if (!striking.length) console.log('  (none — either nothing ranks on page 2-4 yet, or impressions are too thin to read)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
