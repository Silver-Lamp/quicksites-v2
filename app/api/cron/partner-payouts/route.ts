import { NextRequest, NextResponse } from 'next/server';
import { runPayouts } from '@/lib/commerce/payouts';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// System actor for cron-initiated payout runs. payout_runs.actor_user_id is a
// plain uuid (no FK), so a fixed sentinel keeps the audit row honest ("ran by
// the scheduler, not a human").
const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000';

// Pay out all approved partner commissions on a schedule, closing the
// referral/affiliate loop (the engine — Stripe Connect transfers, idempotent,
// claim-before-move — already lives in lib/commerce/payouts.ts#runPayouts; this
// only schedules it). approve-commissions runs first (daily 08:00) to move rows
// past the refund window into 'approved'; this runs after so it has something to pay.
//
// Flag-gated OFF by default: this MOVES REAL MONEY. Set PARTNER_PAYOUTS_CRON_ENABLED=true
// once the payout flow is trusted in prod. When off, it no-ops (records a skipped run).
//
// Auth via isCronAuthorized (matches every other cron): accepts Vercel's native
// `Authorization: Bearer <CRON_SECRET>` as well as x-cron-secret / x-cron-key.
async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return runCron('partner-payouts', async () => {
    if (process.env.PARTNER_PAYOUTS_CRON_ENABLED !== 'true') {
      return NextResponse.json({ ok: true, skipped: 'PARTNER_PAYOUTS_CRON_ENABLED not set' });
    }
    const result = await runPayouts({
      actorUserId: SYSTEM_ACTOR_ID,
      actorEmail: 'cron@partner-payouts',
      dryRun: false,
    });
    return NextResponse.json({ ok: true, ...result });
  });
}

export const GET = handle;
export const POST = handle;
