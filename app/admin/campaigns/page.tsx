'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';
import dayjs from 'dayjs';
import { enrichLead } from '@/lib/leads/enrichLead';

import type { Lead as BaseLead } from '@/types/lead.types';

type Campaign = {
  id: string;
  name: string;
  city: string;
  starts_at: string;
  ends_at: string;
};

type Lead = BaseLead & {
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showUnlinked, setShowUnlinked] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leadsByCampaign, setLeadsByCampaign] = useState<Record<string, Lead[]>>({});
  const [now, setNow] = useState(dayjs());
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data?.user?.email ?? null);
    });

    Promise.all([
      supabase
        .from('campaigns')
        .select('id, name, city, starts_at, ends_at, lead_ids')
        .order('starts_at', { ascending: false }),

      supabase
        .from('leads')
        .select('*, draft_sites:domain_id(domain, is_claimed), users:user_profiles!owner_id(email)')
    ]).then(([campaignRes, leadRes]) => {
      console.log('[🟢 Campaign Data]', campaignRes.data);
      console.log('[🟢 Lead Data]', leadRes.data);

      setCampaigns(campaignRes.data || []);

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

      console.log('[🧩 Grouped Leads]', grouped);
      setLeadsByCampaign(grouped);
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(dayjs()), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Campaigns</h1>
      {campaigns.map((c) => {
        const leads = leadsByCampaign[c.id] || [];
        const start = dayjs(c.starts_at);
        const end = dayjs(c.ends_at);
        const isActive = now.isAfter(start) && now.isBefore(end);
        const isUpcoming = now.isBefore(start);
        const isEnded = now.isAfter(end);
        const minutesLeft = end.diff(now, 'minute');
        const totalDuration = end.diff(start, 'minute');
        const minutesElapsed = now.diff(start, 'minute');
        const progressPercent = Math.min(Math.max((minutesElapsed / totalDuration) * 100, 0), 100);
        const isExpanded = expanded[c.id] ?? isActive;

        let panelColor = 'bg-zinc-800';
        let statusLabel = '';
        let borderColor = 'border-zinc-700';

        if (isActive) {
          panelColor = 'bg-green-900';
          borderColor = 'border-green-600';
          const days = Math.floor(minutesLeft / 1440);
          const hours = Math.floor((minutesLeft % 1440) / 60);
          statusLabel = `🟢 Active — ${days}d ${hours}h left`;
        } else if (isUpcoming) {
          panelColor = 'bg-yellow-900';
          borderColor = 'border-yellow-600';
          const minsUntilStart = start.diff(now, 'minute');
          const d = Math.floor(minsUntilStart / 1440);
          const h = Math.floor((minsUntilStart % 1440) / 60);
          statusLabel = `🟡 Starts in ${d}d ${h}h`;
        } else {
          panelColor = 'bg-zinc-800 opacity-80';
          borderColor = 'border-zinc-600';
          const minsAgo = now.diff(end, 'minute');
          const dAgo = Math.floor(minsAgo / 1440);
          const hAgo = Math.floor((minsAgo % 1440) / 60);
          statusLabel = `🔴 Ended ${dAgo}d ${hAgo}h ago`;
        }

        return (
          <div
            key={c.id}
            className={`mb-4 p-4 rounded shadow text-white cursor-pointer border ${panelColor} ${borderColor} hover:opacity-90 transition`}
            onClick={() => handleToggleExpand(c.id)}
          >
            <div className="text-lg font-semibold">{c.name} — {c.city}</div>
            <div className="text-sm text-zinc-300" title={`Start: ${start.format('MMM D, h:mm A')} • End: ${end.format('MMM D, h:mm A')}`}>{statusLabel}</div>
            {isActive && (
              <div className="h-1 bg-zinc-700 mt-1 mb-2 rounded overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
            <div className="text-sm text-zinc-400">
              {leads.length > 0 ? `Linked Leads: ${leads.length}` : 'No leads linked.'}
            </div>
            {isExpanded && (
              <div className="mt-2 space-y-2">
                {leads.map((lead) => (
                  <div key={lead.id} className="p-2 rounded bg-zinc-900 border border-zinc-700">
                    <div className="font-semibold text-sm">{lead.business_name}</div>
                    <div className="text-xs text-zinc-400">{lead.address_city}, {lead.address_state}</div>
                    <div className="text-xs text-zinc-500 italic">{lead.industry}</div>
                    <div className="text-xs text-zinc-400">{lead.phone} • {lead.email}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

CampaignsPage.getLayout = function getLayout(page: React.ReactNode) {
  return <>{page}</>;
};
