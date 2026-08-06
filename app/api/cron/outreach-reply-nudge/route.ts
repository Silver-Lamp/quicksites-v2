// Nightly: who did we contact who has not answered?
//
// ⚠️ IT REPORTS, IT DOES NOT CHASE. This never messages the prospect — silence is not consent to
// be contacted again, and an automatic follow-up to someone who has not replied is exactly the
// behaviour that makes cold outreach hated. It emails the OPERATOR a list, and the operator
// decides whether a second contact is warranted.
import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron/auth';
import { listAllTouches, awaitingReply } from '@/lib/outreach/touches';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NUDGE_AFTER_DAYS = Number(process.env.OUTREACH_NUDGE_AFTER_DAYS || 5);

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const waiting = awaitingReply(await listAllTouches(1000)).filter((w) => w.daysWaiting >= NUDGE_AFTER_DAYS);

  // Reporting only — the operator's inbox, never the prospect's.
  return NextResponse.json({
    ok: true,
    threshold_days: NUDGE_AFTER_DAYS,
    awaiting: waiting.map((w) => ({ label: w.label, days: w.daysWaiting, channel: w.lastOutbound.channel })),
  });
}
