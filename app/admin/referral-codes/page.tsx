// app/admin/referral-codes/page.tsx
//
// Referral Codes — the simple "mint a code and share it" surface. Create a vanity code (no
// owner needed yet), copy its link, watch signups + held commissions accrue, and finalize the
// owner once they sign up + connect Stripe. Admin-gated shell; the client does its own fetches.
// The month-end payout mechanics live on /admin/referrals (payout wizard).

import { getAdminUser } from '@/lib/auth/getAdminUser';
import ReferralCodesClient from '@/components/admin/referral-codes-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'Referral Codes' };

export default async function ReferralCodesPage() {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-neutral-400">Forbidden.</div>;
  return <ReferralCodesClient />;
}
