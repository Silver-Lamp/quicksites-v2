// app/admin/ops/page.tsx
//
// High-level operations dashboard — one screen for the health of inventory, markets,
// and clients, plus the prioritized next-steps worklist. Admin-gated; fetches the
// cross-domain snapshot server-side and hands it to the client shell (which fetches
// live Google rank).

import { getAdminUser } from '@/lib/auth/getAdminUser';
import { assembleOpsSnapshot } from '@/lib/ops/opsSnapshotServer';
import OpsDashboardClient from '@/components/admin/ops-dashboard-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function OpsPage() {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-neutral-400">Forbidden.</div>;

  const snapshot = await assembleOpsSnapshot();

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <OpsDashboardClient snapshot={snapshot} />
    </div>
  );
}
