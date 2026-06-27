import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { approveCommissions } from '@/lib/commerce/payouts';
import { REFUND_WINDOW_DAYS } from '@/lib/commerce/partner-terms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/partners/payouts/approve
 * Move partner commissions 'pending' → 'approved' once past the refund window.
 * Optional body: { refundWindowDays }. Admin-gated. (Also safe as a cron target.)
 */
export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const days = Number(body?.refundWindowDays) > 0 ? Number(body.refundWindowDays) : REFUND_WINDOW_DAYS;
  const approved = await approveCommissions(days);
  return NextResponse.json({ approved, refundWindowDays: days });
}
