import { NextRequest, NextResponse } from 'next/server';
import { approveCommissions } from '@/lib/commerce/payouts';
import { runCron } from '@/lib/cron/record';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Auto-approve partner commissions once past the refund window.
// Protected by the x-cron-secret header (matches the other crons).
function authorize(req: NextRequest) {
  return req.headers.get('x-cron-secret') === process.env.CRON_SECRET;
}

async function handle(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return runCron('approve-commissions', async () => {
    const approved = await approveCommissions();
    return NextResponse.json({ ok: true, approved });
  });
}

export const GET = handle;
export const POST = handle;
