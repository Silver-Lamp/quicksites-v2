// app/admin/prospects/page.tsx
//
// "Businesses near me" — the geographic lead-gen fan-out. Now also a tab inside the unified
// Growth workspace (/admin/growth?tab=prospects); this standalone route stays as an alias.
// Admin-gated.

import { getAdminUser } from '@/lib/auth/getAdminUser';
import ProspectsClient from '@/components/admin/prospects-client';
import { loadProspectsWorkspaceData } from '@/lib/outreach/growthData';
import { outreachReadinessGateEnabled } from '@/lib/flags/outreachReadinessGate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function ProspectsPage() {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-neutral-400">Forbidden.</div>;

  const { prospects, campaigns, channels, callCounts } = await loadProspectsWorkspaceData();

  return (
    <ProspectsClient
      initialProspects={prospects}
      initialCampaigns={campaigns}
      channels={channels}
      callCounts={callCounts}
      readinessGate={outreachReadinessGateEnabled()}
    />
  );
}
