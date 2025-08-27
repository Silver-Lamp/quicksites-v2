// components/admin/campaigns/campaign-panel.tsx

import { CampaignType } from '@/types/campaign.types';
import { Lead } from '@/types/lead.types';
import dayjs, { Dayjs } from 'dayjs';
import { Suspense, useMemo, useState } from 'react';
import ClaimPoster from './claim-poster';
import TowTruckLogo from 'public/images/campaigns/tow-truck-logo.png'; // adjust path as needed

export type Props = {
  campaign: CampaignType;
  leads: Lead[];
  now: Dayjs;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  setEditingCampaign: (c: CampaignType) => void;
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
  const [posterEditing, setPosterEditing] = useState(false);

  const start = dayjs(campaign.starts_at || new Date());
  const end = dayjs(campaign.ends_at || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)); // 3 days from now 
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

  const topTwoLeads = leads.slice(0, 2);

  const handlePanelClick = () => {
    if (!posterEditing) {
      setEditingCampaign(campaign);
      setSelectedLeadIds(campaign.lead_ids ?? []);
    }
  };

  return (
    <div
      className={`border p-4 rounded shadow mb-4 transition hover:opacity-90 text-white ${
        isActive ? 'bg-green-900 border-green-600' : isUpcoming ? 'bg-yellow-900 border-yellow-600' : 'bg-zinc-800 border-zinc-600 opacity-80'
      }`}
    >
      <div className="flex items-center justify-between mb-1 gap-3">
        <button
          className="text-xs bg-zinc-700 hover:bg-zinc-600 px-2 py-1 rounded text-white"
          onClick={() => {
            if (!posterEditing) {
              setEditingCampaign(campaign);
              setSelectedLeadIds(campaign.lead_ids ?? []);
            }
          }}
        >
          Edit
        </button>
        <div className="font-semibold text-lg">{campaign.name} — {campaign.city}</div>
        <div
          className="text-sm text-zinc-300"
          title={`Start: ${start.format('MMM D, h:mm A')} • End: ${end.format('MMM D, h:mm A')}`}
        >
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
        <div className="mt-4">
          {topTwoLeads.length === 2 && campaign.alt_domains?.[0] ? (
            <Suspense fallback={<div>Loading...</div>}>
              <ClaimPoster
                domain={campaign.alt_domains[0]}
                offerEndsAt={campaign.ends_at}
                arcOffsetY={campaign.arc_offset_y}
                logoOffsetY={campaign.logo_offset_y}
                arcRadius={campaign.arc_radius}
                leadA={{ name: topTwoLeads[0].business_name || 'Lead A' }}
                leadB={{ name: topTwoLeads[1].business_name || 'Lead B' }}
                qrUrl={`/claim/${campaign.alt_domains[0]}`}
                imageSrc={campaign.logo_url || TowTruckLogo.src}
                campaignId={campaign.id}
                onEditStart={() => setPosterEditing(true)}
                onEditEnd={() => setPosterEditing(false)}
                expired={isEnded}
                contactPhone={campaign.contact_phone || ''}
                contactEmail={campaign.contact_email || ''}
              />
            </Suspense>
          ) : (
            <div className="space-y-2">
              {leads.map((l) => (
                <div key={l.id} className="p-2 rounded bg-zinc-900 border border-zinc-700">
                  <div className="font-semibold text-sm">{l.business_name}</div>
                  <div className="text-xs text-zinc-400">{l.address_city}, {l.address_state}</div>
                  <div className="text-xs text-zinc-500 italic">{l.industry}</div>
                  <div className="text-xs text-zinc-400">{l.phone} • {l.email}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
