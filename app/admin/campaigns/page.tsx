// Split the component into smaller, maintainable files
// This is the root container component that will render child components
// Actual components should be split into: CampaignPanel.tsx, EditCampaignModal.tsx, CampaignHeader.tsx, etc.

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';
import dayjs from 'dayjs';
import { enrichLead } from '@/lib/leads/enrichLead';
import type { Lead as BaseLead } from '@/types/lead.types';
import { getLatLonForCityState } from '@/lib/utils/geocode';
import { sortLeadsByDistance } from '@/lib/leads/distance';
import CampaignHeader from '@/components/admin/campaigns/campaign-header';
import CampaignPanel from '@/components/admin/campaigns/campaign-panel';
import EditCampaignModal from '@/components/admin/campaigns/edit-campaign-modal';
import { CampaignType } from '@/types/campaign.types';

export type Lead = BaseLead & {
  draft_sites?: {
    domain?: string;
    is_claimed?: boolean;
  };
  users?: {
    email?: string;
  };
  link_type: string | null;
};

export default function CampaignsPage() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published' | 'paused' | 'archived'>('published');
  const [campaigns, setCampaigns] = useState<CampaignType[]>([]);
  const [leadsByCampaign, setLeadsByCampaign] = useState<Record<string, Lead[]>>({});
  const [now, setNow] = useState(dayjs());
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<CampaignType | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [geoCenter, setGeoCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data?.user?.email ?? null);
    });
  
    async function loadData() {
      const [{ data: campaignData }, { data: leadData }, { data: linkData }] = await Promise.all([
        supabase
          .from('campaigns')
          .select('id, name, city, city_lat, city_lon, starts_at, ends_at, status, industry, state, silent_mode, alt_domains')
          .order('starts_at', { ascending: false }),
  
        supabase
          .from('leads')
          .select('*, draft_sites:domain_id(domain, is_claimed), users:user_profiles!owner_id(email)'),
  
        supabase
          .from('campaign_leads')
          .select('campaign_id, lead_id'),
      ]);
  
      setCampaigns(campaignData || []);
      setAllLeads(leadData || []);
  
      // Build a campaignId → leadIds[] map
      const campaignMap = new Map<string, string[]>();
      for (const row of linkData || []) {
        const list = campaignMap.get(row.campaign_id) ?? [];
        list.push(row.lead_id);
        campaignMap.set(row.campaign_id, list);
      }
  
      // Group enriched leads under each campaign
      const grouped: Record<string, Lead[]> = {};
      for (const rawLead of leadData || []) {
        const lead = enrichLead(rawLead, campaignMap);
        if (!lead) continue;
  
        const foundCampaignId = [...campaignMap.entries()].find(([_, ids]) =>
          ids.includes(lead.id)
        )?.[0];
  
        const campaignKey = foundCampaignId ?? '__unlinked__';
        if (!grouped[campaignKey]) grouped[campaignKey] = [];
        grouped[campaignKey].push(lead);
      }
  
      setLeadsByCampaign(grouped);
    }
  
    loadData();
  }, []);
  

  useEffect(() => {
    if (editingCampaign) {
      getLatLonForCityState(editingCampaign.city).then((coords) => {
        if (coords) setGeoCenter(coords);
      });
    }
  }, [editingCampaign]);

  useEffect(() => {
    const interval = setInterval(() => setNow(dayjs()), 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6">
      <CampaignHeader
        showTimestamps={showTimestamps}
        setShowTimestamps={setShowTimestamps}
      />
      <div className="mb-4">
        <label className="text-sm font-medium text-white mr-2">Filter by status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'draft' | 'published' | 'paused' | 'archived')}
          className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-white"
        >
          <option value="all">All</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="paused">Paused</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      {campaigns
        .filter((c) => statusFilter === 'all' || c.status === statusFilter)
        .map((c) => (
          <div key={c.id} className="border-b border-zinc-700 pb-4 mb-4">
            <div className="text-xs text-zinc-400 uppercase mb-1">Status: {c.status}</div>
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
        </div>
      ))}
      {editingCampaign && (
        <EditCampaignModal
          campaign={editingCampaign}
          allLeads={allLeads}
          selectedLeadIds={selectedLeadIds}
          setSelectedLeadIds={setSelectedLeadIds}
          leadsByCampaign={leadsByCampaign}
          geoCenter={geoCenter}
          setEditingCampaign={setEditingCampaign}
        />
      )}
    </div>
  );
}

CampaignsPage.getLayout = function getLayout(page: React.ReactNode) {
  return <>{page}</>;
};
