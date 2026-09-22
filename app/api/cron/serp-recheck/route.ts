// app/api/cron/serp-recheck/route.ts
//
// Re-run the recorded SERP checks on a slow cadence. The point is the TREND, not a fresh answer:
// AI overviews are rolling out across query classes and can turn a winnable page unwinnable with
// nothing else on the page changing, so a niche we passed on in September may be open in March.
//
// ⚠️ THIS SPENDS MONEY ON EVERY RUN, so it is flag-gated (`SERP_RECHECK_ENABLED`) on top of the
// credentials, capped per run (`SERP_RECHECK_MAX`), and re-checks only queries ALREADY in
// serp_observations — it never invents a search. Monthly is the intended cadence; weekly would
// buy noise at four times the price.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { dataForSeoProvider, serpConfigured } from '@/lib/serp/dataforseo';
import { runChecks } from '@/lib/serp/runChecks';
import type { SerpCheck } from '@/lib/serp/checkSets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const DEFAULT_MAX = 25;

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );
}

const enabled = () =>
  process.env.SERP_RECHECK_ENABLED === '1' || process.env.SERP_RECHECK_ENABLED === 'true';

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req) && !(await getAdminUser())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  return runCron('serp-recheck', async () => {
    if (!enabled() || !serpConfigured()) {
      return NextResponse.json({
        ok: true,
        skipped: !enabled() ? 'disabled' : 'unconfigured',
        detail: 'Needs SERP_RECHECK_ENABLED=1 and DataForSEO credentials. Nothing was charged.',
      });
    }

    const db = admin();
    const max = Math.max(1, Number(process.env.SERP_RECHECK_MAX) || DEFAULT_MAX);

    // The distinct queries we have ever recorded, oldest-checked first, so a capped run rotates
    // through the whole set instead of re-checking the same rows every month.
    const { data: rows, error } = await db
      .from('serp_observations')
      .select('niche_key, query, location, checked_at')
      .order('checked_at', { ascending: true })
      .limit(1000);
    if (error) return NextResponse.json({ ok: false, error: 'read' }, { status: 500 });

    const seen = new Set<string>();
    const checks: SerpCheck[] = [];
    for (const r of rows ?? []) {
      const key = `${r.query}|${r.location}`;
      if (seen.has(key)) continue;
      seen.add(key);
      checks.push({ nicheKey: r.niche_key ?? null, query: r.query, location: r.location });
      if (checks.length >= max) break;
    }

    let recorded = 0;
    const outcomes = await runChecks(checks, {
      provider: dataForSeoProvider,
      limit: max,
      record: async (check, r, raw) => {
        const { error: wErr } = await db.from('serp_observations').insert({
          niche_key: check.nicheKey, query: r.query, location: r.location,
          provider: dataForSeoProvider.name, pack_size: r.packSize, ad_count: r.adCount,
          ai_overview: r.aiOverview, blocks_above: r.blocksAbove,
          first_organic_domain: r.firstOrganicDomain, first_organic_kind: r.firstOrganicKind,
          first_organic_rank: r.firstOrganicRank, verdict: r.verdict, reason: r.reason, raw,
        });
        if (!wErr) recorded++;
      },
    });

    return NextResponse.json({
      ok: true,
      checked: outcomes.length,
      recorded,
      failed: outcomes.filter((o) => !o.ok).length,
    });
  });
}

export const GET = handle;
export const POST = handle;
