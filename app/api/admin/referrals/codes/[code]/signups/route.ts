// app/api/admin/referrals/codes/[code]/signups/route.ts
//
// Admin: the users who signed up under a referral code — the "who came in under daniel" list.
// Admin-gated, service-role read of the deny-default referral_signups table.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { listSignupsForCode } from '@/lib/referrals/codes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { code } = await params;
  const signups = await listSignupsForCode(code);
  return NextResponse.json({ signups });
}
