'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';
import dayjs from 'dayjs';
import { enrichLead } from '@/lib/leads/enrichLead';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { sortLeadsByDistance } from '@/lib/leads/distance';
import type { Lead as BaseLead } from '@/types/lead.types';
import Link from 'next/link';

type Campaign = {
  id: string;
  name: string;
  city: string;
  starts_at: string;
  ends_at: string;
  lead_ids?: string[];
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

import { geocodeCity } from '@/lib/utils/geocode';

export default function CampaignsPage() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showUnlinked, setShowUnlinked] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leadsByCampaign, setLeadsByCampaign] = useState<Record<string, Lead[]>>({});
  const [now, setNow] = useState(dayjs());
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [geoCenter, setGeoCenter] = useState<{ lat: number; lon: number } | null>(null);

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

      console.log('[🧩 Grouped Leads]', grouped);
      setLeadsByCampaign(grouped);
    });
  }, []);

  useEffect(() => {
    if (editingCampaign) {
      geocodeCity(editingCampaign.city).then((coords) => {
        if (coords) {
          setGeoCenter(coords);
        }
      });
    }
  }, [editingCampaign]);

  useEffect(() => {
    const interval = setInterval(() => setNow(dayjs()), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <button
          onClick={() => setShowTimestamps((prev) => !prev)}
          className="text-xs text-blue-400 hover:underline"
        >
          {showTimestamps ? 'Hide timestamps' : 'Show timestamps'}
        </button>
      </div>
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
          if (minutesLeft < 720) statusLabel = `🟢 Active — ${days}d ${hours}h left ⏳`;
          else statusLabel = `🟢 Active — ${days}d ${hours}h left`;
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
            onClick={() => {
              setEditingCampaign(c);
              setSelectedLeadIds(Array.isArray(c.lead_ids) ? c.lead_ids.map(String) : []);
            }}
          >
            <div className="text-lg font-semibold">{c.name} — {c.city}</div>
            <div
              title={`Start: ${start.format('MMM D, h:mm A')} • End: ${end.format('MMM D, h:mm A')}`}
              className={showTimestamps ? 'text-sm text-zinc-300' : 'text-sm text-zinc-300 truncate'}
            >
              {statusLabel}
            </div>
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
      {editingCampaign && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-zinc-900 text-white p-6 rounded shadow-xl w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Edit Campaign</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const { error } = await supabase
                  .from('campaigns')
                  .update({
                    name: editingCampaign.name,
                    city: editingCampaign.city,
                    starts_at: editingCampaign.starts_at,
                    ends_at: editingCampaign.ends_at,
                    lead_ids: selectedLeadIds
                  })
                  .eq('id', editingCampaign.id);
                if (!error) {
                  setEditingCampaign(null);
                  location.reload();
                }
              }}
            >
              <label className="block mb-3">
                Name:
                <input
                  className="mt-1 w-full px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-white"
                  value={editingCampaign.name}
                  onChange={(e) => setEditingCampaign({ ...editingCampaign, name: e.target.value })}
                />
              </label>
              <label className="block mb-3">
                City:
                <input
                  className="mt-1 w-full px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-white"
                  value={editingCampaign.city}
                  onChange={(e) => setEditingCampaign({ ...editingCampaign, city: e.target.value })}
                />
              </label>
              <label className="block mb-3">
                Starts At:
                <DatePicker
                  className="mt-1 w-full px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-white"
                  selected={dayjs(editingCampaign.starts_at).toDate()}
                  onChange={(date) => setEditingCampaign({ ...editingCampaign, starts_at: dayjs(date).toISOString() })}
                  showTimeSelect
                  dateFormat="Pp"
                />
              </label>
              <label className="block mb-3">
                Ends At:
                <DatePicker
                  className="mt-1 w-full px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-white"
                  selected={dayjs(editingCampaign.ends_at).toDate()}
                  onChange={(date) => setEditingCampaign({ ...editingCampaign, ends_at: dayjs(date).toISOString() })}
                  showTimeSelect
                  dateFormat="Pp"
                />
              </label>
              {/* <label className="block mb-4">
                Link Leads:
                <p className="text-xs text-zinc-400 mb-2">
                  Showing leads from industry:{' '}
                  <span className="font-semibold">
                    {leadsByCampaign[editingCampaign.id]?.[0]?.industry ?? 'Unknown'}
                  </span>
                </p>
                <div className="max-h-40 overflow-y-auto rounded border border-zinc-700 p-2 bg-zinc-800">
                  {allLeads
                    .filter((lead) =>
                      lead.industry === leadsByCampaign[editingCampaign.id]?.[0]?.industry
                    )
                    .map((lead) => (
                      <div key={lead.id} className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.includes(lead.id)}
                          onChange={() => {
                            setSelectedLeadIds((prev) =>
                              prev.includes(lead.id)
                                ? prev.filter((id) => id !== lead.id)
                                : [...prev, lead.id]
                            );
                          }}
                        />
                        <span className="text-sm text-white">{lead.business_name}</span>
                      </div>
                    ))}
                </div>
              </label> */}
                <Link href="/leads" className="text-sm text-zinc-400 hover:underline">
                  Link Leads
                </Link>
              <div className="max-h-40 overflow-y-auto rounded border border-zinc-700 p-2 bg-zinc-800">
                {sortLeadsByDistance(
                  allLeads.filter(
                    (lead) =>
                      lead.industry === leadsByCampaign[editingCampaign.id]?.[0]?.industry
                  ),
                  47.6062, // temporary Seattle lat
                  -122.3321 // temporary Seattle lon
                ).map((lead) => (
                  <div key={lead.id} className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.includes(lead.id)}
                      onChange={() => {
                        setSelectedLeadIds((prev) =>
                          prev.includes(lead.id)
                            ? prev.filter((id) => id !== lead.id)
                            : [...prev, lead.id]
                        );
                      }}
                    />
                    <span className="text-sm text-white">{lead.business_name}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="text-sm text-zinc-400 hover:underline"
                  onClick={() => setEditingCampaign(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

CampaignsPage.getLayout = function getLayout(page: React.ReactNode) {
  return <>{page}</>;
};
