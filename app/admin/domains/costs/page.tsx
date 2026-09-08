// app/admin/domains/costs/page.tsx
//
// Owned-domain recurring-cost dashboard, plus the two spend tools that used to sit on the
// prospecting page: the buy-list planner (what to acquire next, for a budget) and the
// industrial-park registry pre-warm (an occasional per-metro chore). They moved here because they
// are money decisions, not prospecting — every dollar surface in one place, next to the bill.
// Server component: admin-gates, then hands off to the clients that fetch /api/admin/domains.
// (The sibling /admin/domains page is the legacy `domains`-table list — this is the cost view.)

import { getAdminUser } from '@/lib/auth/getAdminUser';
import DomainsClient from '@/components/admin/domains-client';
import DomainBuyListPlanner from '@/components/admin/domain-buy-list-planner';
import CollapsibleSection from '@/components/admin/collapsible-section';
import ParksPrewarmPanel from '@/components/admin/parks-prewarm-panel';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function DomainCostsPage() {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-neutral-400">Forbidden.</div>;
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <DomainsClient />

      {/* Buy-list planner — spend a fixed budget on the best geo-domains to acquire. */}
      <DomainBuyListPlanner />

      {/* Pre-warm the industrial-park registry for a metro so pitch-site default addresses
          land in a real building. Collapsed by default — an occasional per-metro chore. */}
      <CollapsibleSection
        id="parks-prewarm"
        className="mt-8"
        title="Industrial-park registry"
        subtitle="Pre-warm a metro's parks to ground default office addresses"
        defaultOpen={false}
      >
        <ParksPrewarmPanel />
      </CollapsibleSection>
    </div>
  );
}
