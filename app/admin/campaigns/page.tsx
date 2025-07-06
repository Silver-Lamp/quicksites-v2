// app/admin/campaigns/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import CampaignPanel from '@/components/admin/campaigns/campaign-panel';
import { CampaignType } from '@/types/campaign.types';
import { Lead } from '@/types/lead.types';
import dayjs from 'dayjs';
import EditCampaignModal from '@/components/admin/campaigns/edit-campaign-modal';

export default function CampaignsPage() {
  const supabase = createClientComponentClient();
  const [campaigns, setCampaigns] = useState<CampaignType[]>([]);
  const [leadsByCampaign, setLeadsByCampaign] = useState<Record<string, Lead[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(dayjs());
  const [editingCampaign, setEditingCampaign] = useState<CampaignType | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  useEffect(() => {
    async function fetchData() {
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('*')
        .order('starts_at', { ascending: false });

      const { data: leadData } = await supabase
        .from('leads')
        .select('*');

      const grouped: Record<string, Lead[]> = {};
      for (const lead of leadData || []) {
        const cid = lead.current_campaign_id;
        if (!cid) continue;
        if (!grouped[cid]) grouped[cid] = [];
        grouped[cid].push(lead);
      }

      setCampaigns(campaignData || []);
      setLeadsByCampaign(grouped);
    }

    fetchData();
  }, []);

  return (
    <div className="p-6">
      {editingCampaign && (
        <EditCampaignModal
          campaign={editingCampaign}
          allLeads={Object.values(leadsByCampaign).flat()}
          selectedLeadIds={selectedLeadIds}
          setSelectedLeadIds={setSelectedLeadIds}
          leadsByCampaign={leadsByCampaign}
          setEditingCampaign={setEditingCampaign}
        />
      )}
      {campaigns.map((c) => (
        <CampaignPanel
          key={c.id}
          campaign={c}
          leads={leadsByCampaign[c.id] || []}
          now={now}
          expanded={expanded[c.id] ?? true}
          setExpanded={(v) => setExpanded((prev) => ({ ...prev, [c.id]: v }))}
          setEditingCampaign={setEditingCampaign}
          setSelectedLeadIds={setSelectedLeadIds}
        />
      ))}
    </div>
  );
}
