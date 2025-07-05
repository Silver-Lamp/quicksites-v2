// components/admin/campaigns/campaign-panel.tsx

'use client';

import { Campaign, Lead } from '@/app/admin/campaigns/page';
import dayjs, { Dayjs } from 'dayjs';
import { useMemo } from 'react';

type Props = {
  campaign: Campaign;
  leads: Lead[];
  now: Dayjs;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  setEditingCampaign: (c: Campaign) => void;
  setSelectedLeadIds: (ids: string[]) => void;
};

export default function CampaignPanel({
  campaign,
  leads,
  now,
  expanded,
  setExpanded,
  setEditingCampaign,
  setSelectedLeadIds,
}: Props) {
  const start = dayjs(campaign.starts_at);
  const end = dayjs(campaign.ends_at);
  const isActive = now.isAfter(start) && now.isBefore(end);
  const isUpcoming = now.isBefore(start);
  const isEnded = now.isAfter(end);

  const minutesLeft = end.diff(now, 'minute');
  const minutesElapsed = now.diff(start, 'minute');
  const totalMinutes = end.diff(start, 'minute');
  const progress = Math.min(Math.max((minutesElapsed / totalMinutes) * 100, 0), 100);

  let status = '';
  if (isActive) {
    const d = Math.floor(minutesLeft / 1440);
    const h = Math.floor((minutesLeft % 1440) / 60);
    status = `🟢 Active — ${d}d ${h}h left${minutesLeft < 720 ? ' ⏳' : ''}`;
  } else if (isUpcoming) {
    const mins = start.diff(now, 'minute');
    const d = Math.floor(mins / 1440);
    const h = Math.floor((mins % 1440) / 60);
    status = `🟡 Starts in ${d}d ${h}h`;
  } else {
    const mins = now.diff(end, 'minute');
    const d = Math.floor(mins / 1440);
    const h = Math.floor((mins % 1440) / 60);
    status = `🔴 Ended ${d}d ${h}h ago`;
  }

  return (
    <div
      className={`border p-4 rounded shadow cursor-pointer mb-4 transition hover:opacity-90 text-white ${
        isActive ? 'bg-green-900 border-green-600' : isUpcoming ? 'bg-yellow-900 border-yellow-600' : 'bg-zinc-800 border-zinc-600 opacity-80'
      }`}
      onClick={() => {
        setEditingCampaign(campaign);
        setSelectedLeadIds(campaign.lead_ids ?? []);
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="font-semibold text-lg">{campaign.name} — {campaign.city}</div>
        <div className="text-sm text-zinc-300" title={`Start: ${start.format('MMM D, h:mm A')} • End: ${end.format('MMM D, h:mm A')}`}>
          {status}
        </div>
      </div>

      {isActive && (
        <div className="h-1 bg-zinc-700 mb-2 rounded overflow-hidden">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="text-sm text-zinc-400">
        {leads.length > 0 ? `Linked Leads: ${leads.length}` : 'No leads linked.'}
      </div>

      {expanded && (
        <div className="mt-3 space-y-2">
          {leads.map((l) => (
            <div key={l.id} className="p-2 rounded bg-zinc-900 border border-zinc-700">
              <div className="font-semibold text-sm">{l.business_name}</div>
              <div className="text-xs text-zinc-400">{l.address_city}, {l.address_state}</div>
              <div className="text-xs text-zinc-500 italic">{l.industry}</div>
              <div className="text-xs text-zinc-400">{l.phone} • {l.email}</div>
              {l.distance_km != null && (
                <div className="text-[11px] text-zinc-500">
                  {l.distance_km.toFixed(1)} km away
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
