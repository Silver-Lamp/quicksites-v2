// app/api/admin/referrals/codes/route.ts
//
// Admin: list all referral codes with signup counts + held/paid balances (the Referral Codes
// coverage view). Admin-gated; the referral tables are deny-default RLS so all access is
// service-role behind this route.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { listCodesWithStats, publicBase } from '@/lib/referrals/codes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const codes = await listCodesWithStats();
  return NextResponse.json({ codes, base: publicBase() });
}
