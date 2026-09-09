// app/api/cron/trade-site-mail/route.ts
//
// The afternoon MAIL-ONLY pass. The 06:00 UTC pipeline sweeps a city, builds drafts and mails 10;
// this one, at 20:27 UTC (13:27 PT — the hour by which the previous afternoon's builds have cleared
// the 24h review window), mails whatever else is eligible, in passes of 25, up to
// TRADE_MAIL_AFTERNOON_MAX a day (default 50, hard max 100). It sweeps nothing and builds nothing,
// so volume never drains the planned city queue.
//
// Owner's standing instruction (2026-09-09): "send more as able" — and it must survive a restart,
// which a session-scoped scheduler does not. The review window is NOT a knob here either.
import { NextRequest, NextResponse } from 'next/server';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { pipelineEnabled, mailEnabled, runTradePipeline, OVERRIDE_LIMITS } from '@/lib/tradeSites/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Cards this route may mail per day-run: env-tunable, clamped [0, 100]. */
export function afternoonMailMax(): number {
  const n = Number(process.env.TRADE_MAIL_AFTERNOON_MAX);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.floor(n))) : 50;
}

async function handle(req: NextRequest) {
  const admin = await getAdminUser();
  if (!isCronAuthorized(req) && !admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  return runCron('trade-site-mail', async () => {
    if (!pipelineEnabled()) return NextResponse.json({ ok: true, skipped: 'disabled', detail: 'TRADE_PIPELINE_ENABLED is off.' });
    if (!mailEnabled()) return NextResponse.json({ ok: true, skipped: 'mail_off', detail: 'TRADE_PIPELINE_MAIL_ENABLED is off.' });

    const dayMax = afternoonMailMax();
    const passes: Array<{ candidates: number; mailed: number; blocked: number; failed: number; reason?: string; failures: string[] }> = [];
    let mailed = 0;
    let stop: string | null = null;
    // Passes of 25 (the per-send cap) until a pass mails nothing, the day cap is reached, or a
    // failure looks like Lob rate-limiting — a fleet of retries against a 429 is how a bill doubles.
    while (mailed < dayMax && !stop) {
      const report = await runTradePipeline({ maxSweeps: 0, maxBuilds: 0, maxMail: Math.min(OVERRIDE_LIMITS.maxMail, dayMax - mailed), operatorId: admin?.id ?? null });
      const m = report.mail;
      if (!m) { stop = 'mail_step_off'; break; }
      const failures = m.results.filter((r) => !r.ok && r.error).map((r) => `${r.businessName}: ${r.error}`);
      passes.push({ candidates: m.candidates, mailed: m.mailed, blocked: m.blocked, failed: m.failed, reason: m.reason, failures });
      mailed += m.mailed;
      if (m.reason) stop = m.reason;
      else if (failures.some((f) => /429|rate limit|too many requests/i.test(f))) stop = 'rate_limited';
      else if (m.mailed === 0) stop = 'pool_empty';
      if (passes.length >= 4) stop = stop ?? 'pass_cap';
    }
    return NextResponse.json({ ok: true, mailed, dayMax, stop, passes });
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
