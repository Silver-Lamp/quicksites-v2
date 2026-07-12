// app/admin/prospects/page.tsx
//
// "Businesses near me" — the geographic lead-gen fan-out. Sweep a city + categories for
// businesses with no website (or a dated one), park them as prospects, selectively
// build claimable draft sites, and launch location-industry domain campaigns
// (boston-towing.com) from the competition cards. Admin-gated.

import { getAdminUser } from '@/lib/auth/getAdminUser';
import { listProspects, type Prospect } from '@/lib/outreach/prospects';
import { listGeoCampaigns, type GeoCampaign } from '@/lib/outreach/geoCampaigns';
import { postcardMailEnabled } from '@/lib/outreach/mail/lob';
import { prospectSmsEnabled } from '@/lib/outreach/sms/outreachSms';
import { callTrackingEnabled } from '@/lib/outreach/callTracking';
import { supabaseAdmin } from '@/lib/supabase/admin';
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
  const channels = { mail: postcardMailEnabled(), sms: prospectSmsEnabled(), call: callTrackingEnabled() };

  // Tracked-call counts per campaign (proof of lead volume).
  const callCounts: Record<string, number> = {};
  const campaignIds = campaigns.map((c) => c.id);
  if (campaignIds.length) {
    try {
      const { data } = await supabaseAdmin
        .from('call_logs')
        .select('geo_campaign_id')
        .in('geo_campaign_id', campaignIds);
      for (const row of (data as { geo_campaign_id: string | null }[]) ?? []) {
        if (row.geo_campaign_id) callCounts[row.geo_campaign_id] = (callCounts[row.geo_campaign_id] ?? 0) + 1;
      }
    } catch {
      /* best-effort */
    }
  }

  return (
    <ProspectsClient
      initialProspects={active}
      initialCampaigns={campaigns}
      channels={channels}
      callCounts={callCounts}
    />
  );
}
