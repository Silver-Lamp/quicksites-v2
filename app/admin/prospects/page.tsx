// app/admin/prospects/page.tsx
//
// "Businesses near me" — the geographic lead-gen fan-out. Sweep a city + categories for
// businesses with no website (or a dated one), park them as prospects, selectively
// build claimable draft sites, and launch location-industry domain campaigns
// (boston-towing.com) from the competition cards. Admin-gated.

import { getAdminUser } from '@/lib/auth/getAdminUser';
import { listProspects, type Prospect } from '@/lib/outreach/prospects';
import { listGeoCampaigns, type GeoCampaign } from '@/lib/outreach/geoCampaigns';
import ProspectsClient from '@/components/admin/prospects-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function ProspectsPage() {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-neutral-400">Forbidden.</div>;

  let prospects: Prospect[] = [];
  let campaigns: GeoCampaign[] = [];
  try {
    [prospects, campaigns] = await Promise.all([listProspects({ limit: 500 }), listGeoCampaigns()]);
  } catch {
    // Table likely not migrated yet — the client renders a hint.
  }
  const active = prospects.filter((p) => p.status !== 'dismissed');

  return <ProspectsClient initialProspects={active} initialCampaigns={campaigns} />;
}
