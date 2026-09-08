// app/api/admin/prospects/sweep-queue/plan/route.ts
//
// Let the data pick the queue. POST { limit?, cooldownDays? } → the ranked plan with a reason per
// row. POST { apply: true, rows: [{city, region, category}] } → write exactly the rows the operator
// ticked, BEHIND whatever is already queued, in that order (already-queued pairs are skipped, not
// duplicated). `apply` without `rows` writes the whole fresh plan. Admin-gated. Planning spends
// nothing; the cron spends, at its caps, when it drains.
import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { planTradeQueue, enqueuePlan, type PlanRowInput } from '@/lib/tradeSites/planQueue';
import { pipelineEnabled, pipelineCaps } from '@/lib/tradeSites/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function pickRows(raw: unknown): PlanRowInput[] | null {
  if (!Array.isArray(raw)) return null;
  const rows: PlanRowInput[] = [];
  for (const r of raw) {
    const city = String((r as any)?.city ?? '').trim();
    const region = String((r as any)?.region ?? '').trim();
    const category = String((r as any)?.category ?? '').trim();
    if (city && region && category) rows.push({ city, region, category });
  }
  return rows;
}

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const apply = body.apply === true;
  const chosen = apply ? pickRows(body.rows) : null;
  if (apply && chosen !== null && !chosen.length) return NextResponse.json({ error: 'No rows ticked.' }, { status: 400 });

  const limit = Math.max(1, Math.min(Number(body.limit) || 14, 60));
  const cooldownDays = Number.isFinite(Number(body.cooldownDays)) ? Number(body.cooldownDays) : undefined;
  const { plan, skipped } = await planTradeQueue({ limit, cooldownDays });
  const toQueue = apply ? (chosen ?? plan) : [];
  const result = toQueue.length ? await enqueuePlan(toQueue, admin.id) : null;
  return NextResponse.json({
    ok: true,
    applied: !!result,
    inserted: result?.inserted ?? 0,
    rejected: result?.rejected ?? [],
    skippedQueued: result?.skippedQueued ?? 0,
    queuedAhead: result?.queuedAhead ?? 0,
    plan,
    skipped,
    enabled: pipelineEnabled(),
    caps: pipelineCaps(),
  });
}
