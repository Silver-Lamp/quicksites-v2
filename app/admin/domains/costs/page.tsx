// app/admin/domains/costs/page.tsx
//
// Owned-domain recurring-cost dashboard. Server component: admin-gates, then hands off to
// the client that fetches /api/admin/domains (inventory + rollup + forward-looking spend).
// (The sibling /admin/domains page is the legacy `domains`-table list — this is the cost view.)

import { getAdminUser } from '@/lib/auth/getAdminUser';
import DomainsClient from '@/components/admin/domains-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function DomainCostsPage() {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-neutral-400">Forbidden.</div>;
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <DomainsClient />
    </div>
  );
}
