import { NextRequest, NextResponse } from 'next/server';
import { approveCommissions } from '@/lib/commerce/payouts';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Auto-approve partner commissions once past the refund window, so payouts don't
// bottleneck on manual review. Runs daily via vercel.json.
//
// Auth via isCronAuthorized (matches every other cron): it accepts Vercel's
// native `Authorization: Bearer <CRON_SECRET>` as well as the custom
// x-cron-secret / x-cron-key headers. The previous handler only checked
// x-cron-secret, which Vercel's scheduler never sends — so the registered cron
// was silently rejected and the auto-approval loop never actually ran.
async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return runCron('approve-commissions', async () => {
    const approved = await approveCommissions();
    return NextResponse.json({ ok: true, approved });
  });
}

export const GET = handle;
export const POST = handle;
