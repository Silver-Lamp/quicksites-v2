// app/api/admin/prospects/sweep-queue/plan/route.ts
//
// Let the data pick the queue. POST { limit?, cooldownDays?, apply? } → the ranked plan with a
// reason per row; with apply:true the rows are written to trade_sweep_queue in that order.
// Admin-gated. Planning spends nothing; the cron spends, at its caps, when it drains.
import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { planTradeQueue, enqueuePlan } from '@/lib/tradeSites/planQueue';
import { pipelineEnabled, pipelineCaps } from '@/lib/tradeSites/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const limit = Math.max(1, Math.min(Number(body.limit) || 14, 60));
  const cooldownDays = Number.isFinite(Number(body.cooldownDays)) ? Number(body.cooldownDays) : undefined;
  const { plan, skipped } = await planTradeQueue({ limit, cooldownDays });
  const result = body.apply === true && plan.length ? await enqueuePlan(plan, admin.id) : null;
  return NextResponse.json({
    ok: true,
    applied: !!result,
    inserted: result?.inserted ?? 0,
    rejected: result?.rejected ?? [],
    plan,
    skipped,
    enabled: pipelineEnabled(),
    caps: pipelineCaps(),
  });
}
