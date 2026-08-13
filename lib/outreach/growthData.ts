// lib/outreach/growthData.ts
//
// Shared server-side loaders for the Growth workspace tabs, so the unified /admin/growth
// page and the standalone /admin/prospects + /admin/outreach pages fetch identically.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { getDemandDetails } from '@/lib/menu/demand';
import { detectSignals, sortSignals } from '@/lib/outreach/draftSignals';
import { resolveListingPhone } from '@/lib/claim/resolveListingPhone';
import { listProspects, type Prospect } from '@/lib/outreach/prospects';
import { listGeoCampaigns, type GeoCampaign } from '@/lib/outreach/geoCampaigns';
import { postcardMailEnabled } from '@/lib/outreach/mail/lob';
import { prospectSmsEnabled } from '@/lib/outreach/sms/outreachSms';
import { callTrackingEnabled } from '@/lib/outreach/callTracking';
import type { OutreachDraft } from '@/components/admin/outreach-pipeline';

export type ProspectsWorkspaceData = {
  prospects: Prospect[];
  campaigns: GeoCampaign[];
  channels: { mail: boolean; sms: boolean; call: boolean };
  callCounts: Record<string, number>;
};

/** Everything the Businesses-Near-Me surface needs (prospects, geo campaigns, channels, calls). */
export async function loadProspectsWorkspaceData(): Promise<ProspectsWorkspaceData> {
  let prospects: Prospect[] = [];
  let campaigns: GeoCampaign[] = [];
  try {
    [prospects, campaigns] = await Promise.all([listProspects({ limit: 500 }), listGeoCampaigns()]);
  } catch {
    // Table likely not migrated yet — the client renders a hint.
  }
  const active = prospects.filter((p) => p.status !== 'dismissed');
  const channels = { mail: postcardMailEnabled(), sms: prospectSmsEnabled(), call: callTrackingEnabled() };

  const callCounts: Record<string, number> = {};
  const campaignIds = campaigns.map((c) => c.id);
  if (campaignIds.length) {
    try {
      const { data } = await supabaseAdmin.from('call_logs').select('geo_campaign_id').in('geo_campaign_id', campaignIds);
      for (const row of (data as { geo_campaign_id: string | null }[]) ?? []) {
        if (row.geo_campaign_id) callCounts[row.geo_campaign_id] = (callCounts[row.geo_campaign_id] ?? 0) + 1;
      }
    } catch {
      /* best-effort */
    }
  }
  return { prospects: active, campaigns, channels, callCounts };
}

/** The auto-built listing-import draft sites for the Outreach Pipeline surface. */
export async function loadOutreachDrafts(): Promise<OutreachDraft[]> {
  try {
    const { data } = await supabaseAdmin
      .from('templates')
      .select('id, slug, business_name, template_name, created_at, claim_source, data')
      .in('claim_source', ['listing_import', 'listing_claimed'])
      .order('created_at', { ascending: false })
      .limit(300);
    const rows = (data as OutreachDraft[]) ?? [];
    // Attach demand detail (count + the actual leads) + the restaurant's own phone, so the
    // operator can see who tried to order and follow up by hand while auto-SMS is off.
    const details = await getDemandDetails(rows.map((r) => r.id));
    return rows.map((r) => {
      const d = details[r.id];
      return {
        ...r,
        demand: d?.count ?? 0,
        demandCalls: d?.calls ?? 0,
        demandLeads: d?.leads ?? [],
        demandNotified: d?.notified ?? false,
        // Only resolve the restaurant phone when there's demand worth acting on.
        restaurantPhone: d?.count ? resolveListingPhone({ data: r.data }) : null,
        // What is notable/wrong about this draft. Computed here rather than in the client so the
        // operator sees it in the list, before anyone writes a message about a page they have not
        // read — which is exactly how a false claim about a menu reached a real business.
        signals: sortSignals(detectSignals(r.data)),
      };
    });
  } catch {
    return [];
  }
}
