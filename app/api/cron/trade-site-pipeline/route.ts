// app/api/cron/trade-site-pipeline/route.ts
//
// Nightly: drain the sweep queue (a person chose the cities), then build a draft for every
// no-website trade business that has none. Cron-secret or admin. Flag-gated because both halves
// spend money (Places calls, metered LLM copy) — and it says which cap it ran under, so a quiet
// night reads as "nothing queued", never as "off".
//
// ⚠️ It reports counts AND the first few names built, because a job that processes a hundred
// things and builds none of them still says ok (handoff 2026-09-07: the rank sync did exactly
// that for months).
import { NextRequest, NextResponse } from 'next/server';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { pipelineEnabled, pipelineCaps, runTradePipeline } from '@/lib/tradeSites/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function handle(req: NextRequest) {
  const admin = await getAdminUser();
  if (!isCronAuthorized(req) && !admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  return runCron('trade-site-pipeline', async () => {
    if (!pipelineEnabled()) {
      return NextResponse.json({ ok: true, skipped: 'disabled', detail: 'Set TRADE_PIPELINE_ENABLED=1 to sweep the queue and build drafts nightly.', caps: pipelineCaps() });
    }
    const report = await runTradePipeline({ operatorId: admin?.id ?? null });
    const sample = report.builds.results.filter((r) => r.ok).slice(0, 3).map((r) => r.slug);
    return NextResponse.json({
      ok: true,
      sweeps: report.sweeps.length,
      sweepsFailed: report.sweeps.filter((s) => !s.ok).length,
      noWebsiteFound: report.sweeps.reduce((n, s) => n + (s.noWebsite ?? 0), 0),
      built: report.builds.built,
      buildsFailed: report.builds.failed,
      sample,
      caps: report.caps,
      report,
    });
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
