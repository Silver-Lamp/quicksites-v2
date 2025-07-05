// components/admin/campaigns/lead-selector-with-radius.tsx
'use client';

import { useEffect, useState } from 'react';
import { getDistanceMiles } from '@/lib/utils/distance';

type Lead = {
    id: string;
    business_name: string;
    address_lat?: number | null;
    address_lon?: number | null;
    address_city?: string | null;
    address_state?: string | null;
    industry?: string | null;
    current_campaign_id?: string | null;
    current_campaign_expires_at?: string | null;
  };
  

type Props = {
  leads: Lead[];
  selectedLeadIds: string[];
  setSelectedLeadIds: (ids: string[]) => void;
  cityLat: number | null | undefined;
  cityLon: number | null | undefined;
  radius: number;
  setRadius: (radius: number) => void;
  geoCenter?: { lat: number; lon: number } | null;
  industry?: string | null;
  state?: string | null;
  currentCampaignId?: string | null;
  currentCampaignExpiresAt?: string | null;
};

export default function LeadSelectorWithRadius({
  leads,
  selectedLeadIds,
  setSelectedLeadIds,
  cityLat,
  cityLon,
  radius,
  setRadius,
  geoCenter,
  industry,
  currentCampaignId,
  currentCampaignExpiresAt,
}: Props) {
    const isLeadDisabled = (lead: Lead): boolean => {
        if (!lead.current_campaign_id) return false;
      
        const isExpired =
          !lead.current_campaign_expires_at ||
          new Date(lead.current_campaign_expires_at) < new Date();
      
        const isSameCampaign = lead.current_campaign_id === currentCampaignId;
      
        return !(isExpired || isSameCampaign);
      };
    
    const toggle = (id: string) => {
      setSelectedLeadIds(
        selectedLeadIds.includes(id)
          ? selectedLeadIds.filter((x) => x !== id)
          : [...selectedLeadIds, id]
    );
  };

  const resolvedLat = cityLat ?? geoCenter?.lat ?? null;
  const resolvedLon = cityLon ?? geoCenter?.lon ?? null;

  const getDist = (l: Lead) =>
    l.address_lat && l.address_lon && resolvedLat && resolvedLon
      ? getDistanceMiles(l.address_lat, l.address_lon, resolvedLat, resolvedLon)
      : Infinity;

  const filteredLeads = leads.filter((l) =>
    !industry || l.industry?.trim().toLowerCase() === industry.trim().toLowerCase()
  );

  const sortedLeads = filteredLeads
    .filter((l) => getDist(l) <= radius)
    .sort((a, b) => getDist(a) - getDist(b));

  const groupByRange = [
    { label: '0–10 mi', min: 0, max: 10 },
    { label: '10–25 mi', min: 10, max: 25 },
    { label: '25–50 mi', min: 25, max: 50 },
  ];

  const renderLeadLine = (lead: Lead, distanceLabel: string) => {
    const disabled = isLeadDisabled(lead);
  
    return (
      <div key={lead.id} className="flex flex-col gap-1 mb-2">
        <label
          className={`flex items-center gap-2 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={disabled ? 'Already part of an active campaign' : ''}
        >
          <input
            type="checkbox"
            disabled={disabled}
            checked={selectedLeadIds.includes(lead.id)}
            onChange={() => toggle(lead.id)}
          />
          <div className="text-sm text-white">
            <span className="font-semibold">{lead.business_name}</span>{' '}
            <span className="text-xs text-zinc-400">
              ({lead.address_city}, {lead.address_state} • {lead.industry}) — {distanceLabel}
            </span>
          </div>
        </label>
      </div>
    );
  };
  

  const renderGroup = (label: string, min: number, max: number) => {
    const group = sortedLeads.filter((l) => {
      const dist = getDist(l);
      return dist >= min && dist < max;
    });
    if (!group.length) return null;

    return (
      <div key={label} className="pt-2">
        <div className="text-xs font-semibold text-zinc-400 mb-1">{label}</div>
        {group.map((lead) => renderLeadLine(lead, `${getDist(lead).toFixed(1)} mi`))}
      </div>
    );
  };

  const outsideRadius = filteredLeads.filter((l) => getDist(l) > radius);

  return (
    <div className="mb-4">
      <label className="text-sm font-semibold block mb-1">Radius Filter:</label>
      <select
        className="bg-zinc-800 text-white border border-zinc-700 rounded px-2 py-1 mb-3"
        value={radius}
        onChange={(e) => setRadius(Number(e.target.value))}
      >
        {[10, 25, 50, 100].map((r) => (
          <option key={r} value={r}>
            Within {r} miles
          </option>
        ))}
      </select>

      <div className="rounded border border-zinc-700 p-3 bg-zinc-800 divide-y divide-zinc-700 max-h-[320px] overflow-y-auto">
        {groupByRange.map(({ label, min, max }) => renderGroup(label, min, max))}

        {outsideRadius.length > 0 && (
          <div className="pt-4">
            <div className="text-xs font-semibold text-zinc-400 mb-1">Other Leads</div>
            {outsideRadius.map((lead) => renderLeadLine(lead, 'outside radius'))}
          </div>
        )}
      </div>
    </div>
  );
}
