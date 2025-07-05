// Split the component into smaller, maintainable files
// This is the root container component that will render child components
// Actual components should be split into: CampaignPanel.tsx, EditCampaignModal.tsx, CampaignHeader.tsx, etc.

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';
import dayjs from 'dayjs';
import { enrichLead } from '@/lib/leads/enrichLead';
import type { Lead as BaseLead } from '@/types/lead.types';
import { geocodeCity } from '@/lib/utils/geocode';
import { sortLeadsByDistance } from '@/lib/leads/distance';
import CampaignHeader from '@/components/admin/campaigns/campaign-header';
import CampaignPanel from '@/components/admin/campaigns/campaign-panel';
import EditCampaignModal from '@/components/admin/campaigns/edit-campaign-modal';

export type Campaign = {
  id: string;
  name: string;
  city: string;
  starts_at: string;
  ends_at: string;
  lead_ids?: string[];
  city_lat?: number;
  city_lon?: number;
};

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
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leadsByCampaign, setLeadsByCampaign] = useState<Record<string, Lead[]>>({});
  const [now, setNow] = useState(dayjs());
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [geoCenter, setGeoCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data?.user?.email ?? null);
    });

    Promise.all([
      supabase
        .from('campaigns')
        .select('id, name, city, city_lat, city_lon, starts_at, ends_at, lead_ids')
        .order('starts_at', { ascending: false }),
      supabase
        .from('leads')
        .select('*, draft_sites:domain_id(domain, is_claimed), users:user_profiles!owner_id(email)')
    ]).then(([campaignRes, leadRes]) => {
      setCampaigns(campaignRes.data || []);
      setAllLeads(leadRes.data || []);

      const grouped: Record<string, Lead[]> = {};
      const campaignMap = new Map(
        (campaignRes.data || []).map((c) => [c.id, Array.isArray(c.lead_ids) ? c.lead_ids.map(String) : []])
      );

      for (const rawLead of leadRes.data || []) {
        const lead = enrichLead(rawLead, campaignMap);
        if (!lead) continue;

        const campaignKey = lead.campaign_id || '__unlinked__';
        if (!grouped[campaignKey]) grouped[campaignKey] = [];
        grouped[campaignKey].push(lead);
      }

      setLeadsByCampaign(grouped);
    });
  }, []);

  useEffect(() => {
    if (editingCampaign) {
      geocodeCity(editingCampaign.city).then((coords) => {
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
