// app/admin/growth/page.tsx
//
// Unified "Growth" workspace — one home for the lead-gen → outreach funnel, consolidating
// the old scattered Growth nav items (Businesses Near Me, Outreach Pipeline, and the retired
// legacy leads/campaigns/the-grid surfaces) into a single tabbed page. Server component:
// loads both surfaces' data and hands them to the client tab shell as nodes. Admin-gated.

import { Suspense } from 'react';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import ProspectsClient from '@/components/admin/prospects-client';
import OutreachPipeline from '@/components/admin/outreach-pipeline';
import GrowthWorkspace from '@/components/admin/growth-workspace';
import { loadProspectsWorkspaceData, loadOutreachDrafts } from '@/lib/outreach/growthData';
import { outreachReadinessGateEnabled } from '@/lib/flags/outreachReadinessGate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function GrowthPage() {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-neutral-400">Forbidden.</div>;

  const [{ prospects, campaigns, channels, callCounts }, drafts] = await Promise.all([
    loadProspectsWorkspaceData(),
    loadOutreachDrafts(),
  ]);

  return (
    <Suspense fallback={<div className="p-8 text-neutral-400">Loading…</div>}>
      <GrowthWorkspace
        counts={{ prospects: prospects.length, pipeline: drafts.length }}
        prospects={
          <ProspectsClient
            initialProspects={prospects}
            initialCampaigns={campaigns}
            channels={channels}
            callCounts={callCounts}
            readinessGate={outreachReadinessGateEnabled()}
          />
        }
        pipeline={<OutreachPipeline list={drafts} />}
      />
    </Suspense>
  );
}
