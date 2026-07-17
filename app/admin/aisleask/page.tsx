// app/admin/aisleask/page.tsx
//
// AisleAsk Ops — location planning + gig cross-posting. Admin-gated server shell; the client
// does its own data fetching (sweep + coverage are both interactive). Feature A (plan which
// stores to catalog → seed gigs) + Feature B (cross-post the gigs to recruit taskers).
// See docs/AISLEASK_OPS_PLAN.md.

import { getAdminUser } from '@/lib/auth/getAdminUser';
import AisleAskClient from '@/components/admin/aisleask-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'AisleAsk Ops' };

export default async function AisleAskPage() {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-neutral-400">Forbidden.</div>;
  return <AisleAskClient />;
}
