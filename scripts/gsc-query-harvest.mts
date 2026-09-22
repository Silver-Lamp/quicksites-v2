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

  const { startDate, endDate } = defaultWindow();
  const { data: toks } = await supabaseAdmin.from('gsc_tokens').select('domain');
  const domains = [...new Set((toks ?? []).map((t: { domain?: string }) => t.domain).filter(Boolean))] as string[];
  console.log(`${domains.length} connected domains · window ${startDate} → ${endDate}${DRY ? ' · DRY RUN' : ''}\n`);

  type Row = { domain: string; q: string; impr: number; pos: number; clicks: number };
  const all: Row[] = [];
  const striking: Row[] = [];
  let written = 0;
  let failed = 0;

  for (const domain of domains) {
    try {
      const auth = await getValidOAuthClient(domain);
      const sc = google.searchconsole({ version: 'v1', auth });
      const res = await sc.searchanalytics.query({
        siteUrl: domain,
        requestBody: { startDate, endDate, dimensions: ['query'], rowLimit: 500 },
      });
      const rows = parseQueryRows(res.data.rows);
      if (!rows.length) continue;

      if (!DRY) {
        const { error } = await supabaseAdmin.from('gsc_queries').upsert(
          rows.map((r) => ({
            domain, query: r.query, clicks: r.clicks, impressions: r.impressions,
            ctr: r.ctr, position: r.position, start_date: startDate, end_date: endDate,
          })),
          { onConflict: 'domain,query,start_date,end_date' },
        );
        if (error) { console.warn(`  ! ${short(domain)}: ${error.message}`); failed++; continue; }
        written += rows.length;
      }
      for (const r of rows) all.push({ domain, q: r.query, impr: r.impressions, pos: r.position, clicks: r.clicks });
      for (const r of pickStrikingDistance(rows)) {
        if (!isSelfReferential(r.query, domain)) {
          striking.push({ domain, q: r.query, impr: r.impressions, pos: r.position, clicks: r.clicks });
        }
      }
    } catch {
      failed++;
    }
  }

  const line = (r: Row) =>
    `${String(r.impr).padStart(5)} impr  pos ${String(r.pos).padStart(6)}  ${String(r.clicks).padStart(2)} clk  ${r.q}   [${short(r.domain)}]`;

  console.log(`domains with query data: ${new Set(all.map((r) => r.domain)).size} · rows ${DRY ? 'read' : 'written'}: ${DRY ? all.length : written} · failed: ${failed}`);
  console.log(`\n=== What we are actually found for (top 25 by impressions)`);
  [...all].sort((a, b) => b.impr - a.impr).slice(0, 25).forEach((r) => console.log(line(r)));
  console.log(`\n=== Striking distance — pos 11-40, >=10 impressions, self-lookups excluded (${striking.length})`);
  [...striking].sort((a, b) => b.impr - a.impr).slice(0, 25).forEach((r) => console.log(line(r)));
  if (!striking.length) console.log('  (none — either nothing ranks on page 2-4 yet, or impressions are too thin to read)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
