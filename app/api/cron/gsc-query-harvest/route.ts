// app/api/cron/gsc-query-harvest/route.ts
//
// Nightly: ask Search Console for the QUERY dimension on every connected domain and store the
// rows (lib/gsc/queryHarvest.ts explains why this is the one GSC read worth adding).
//
// Read-only against Google and additive here — unlike gsc-backfill it writes no DNS and adds no
// property, so it needs no feature flag, only the cron secret. A domain whose token fails is
// skipped, not retried into a 401 loop: one dead property must not cost the other 91 their harvest.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getValidOAuthClient } from '@/lib/gsc/getValidOAuthClient';
import { defaultWindow, parseQueryRows, summariseQueries } from '@/lib/gsc/queryHarvest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Google caps a query request at 25k rows; we want the head, and a long tail of 1-impression
 *  noise is exactly what MIN_IMPRESSIONS throws away anyway. */
const ROW_LIMIT = 500;

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );
}

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req) && !(await getAdminUser())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  return runCron('gsc-query-harvest', async () => {
    const db = admin();
    const { startDate, endDate } = defaultWindow();

    const { data: tokenRows, error } = await db.from('gsc_tokens').select('domain');
    if (error) return NextResponse.json({ ok: false, error: 'tokens' }, { status: 500 });
    const domains = Array.from(
      new Set((tokenRows || []).map((r: { domain?: string }) => r?.domain).filter(Boolean)),
    ) as string[];

    let harvested = 0;
    let rowsWritten = 0;
    let striking = 0;
    const failed: string[] = [];

    for (const domain of domains) {
      try {
        const auth = await getValidOAuthClient(domain);
        const searchconsole = google.searchconsole({ version: 'v1', auth });
        const res = await searchconsole.searchanalytics.query({
          siteUrl: domain,
          requestBody: { startDate, endDate, dimensions: ['query'], rowLimit: ROW_LIMIT },
        });
        const rows = parseQueryRows(res.data.rows);
        if (!rows.length) {
          harvested++;
          continue;
        }
        const payload = rows.map((r) => ({
          domain,
          query: r.query,
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr,
          position: r.position,
          start_date: startDate,
          end_date: endDate,
          captured_at: new Date().toISOString(),
        }));
        const { error: wErr } = await db
          .from('gsc_queries')
          .upsert(payload, { onConflict: 'domain,query,start_date,end_date' });
        if (wErr) {
          failed.push(domain);
          continue;
        }
        harvested++;
        rowsWritten += payload.length;
        striking += summariseQueries(rows, domain).strikingDistance;
      } catch {
        failed.push(domain);
      }
    }

    return NextResponse.json({
      ok: true,
      window: { startDate, endDate },
      domains: domains.length,
      harvested,
      rowsWritten,
      strikingDistance: striking,
      failed: failed.length,
    });
  });
}

export const GET = handle;
export const POST = handle;
