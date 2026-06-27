import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { runPayouts } from '@/lib/commerce/payouts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/partners/payouts/run
 * Pay out all approved commissions, grouped per partner: Stripe Connect transfer
 * (when the partner is connected + Stripe is configured) or a 'manual' record,
 * writing affiliate_payouts, marking commissions 'paid', and auditing a payout_run.
 * Body: { dryRun?: boolean } — dryRun previews amounts without moving money.
 * Admin-gated.
 */
export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const result = await runPayouts({
    actorUserId: admin.id,
    actorEmail: admin.email ?? undefined,
    dryRun: !!body?.dryRun,
  });
  return NextResponse.json(result);
}
