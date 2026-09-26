// app/api/cron/publish-grace-expiry/route.ts
//
// Takes down sites published by a guest who never confirmed their email.
//
// ⚠️ THIS CRON IS THE HALF THAT MAKES THE OTHER HALF SAFE. "Publish before you confirm" is only
// defensible because the window closes on its own. If this job stops running, every unverified
// publish quietly becomes permanent — and the failure looks exactly like nothing happening, which
// is why it is registered in vercel.json and wrapped in runCron: a silent stop shows up in
// cron_runs and on /admin/cron rather than nowhere.
//
// ⚠️ It refuses to guess. An owner whose auth record cannot be read is LEFT UP and counted as a
// failure — a day late is recoverable; taking down a paying customer's live site because a lookup
// flaked is not.
import { NextRequest, NextResponse } from 'next/server';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
import { sweepExpiredGrace } from '@/lib/guest/publishGraceServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return runCron('publish-grace-expiry', async () => {
    const result = await sweepExpiredGrace();
    // `keptVerified` is reported separately rather than folded into a success count: it means
    // someone confirmed and the row had not caught up, so counting it as an unpublish would
    // overstate what we took down.
    return NextResponse.json({
      ok: true,
      due: result.due,
      unpublished: result.unpublished.length,
      keptVerified: result.keptVerified.length,
      failed: result.failed.length,
      failures: result.failed.slice(0, 5),
    });
  });
}

export const GET = handle;
export const POST = handle;
