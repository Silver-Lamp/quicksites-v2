'use client';

import { useEffect, useState } from 'react';
import { getDistanceMiles } from '@/lib/utils/distance';

type Lead = {
  id: string;
  business_name: string;
  address_lat?: number | null;
  address_lon?: number | null;
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
}: Props) {
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

  const sortedLeads = leads
    .filter((l) => getDist(l) <= radius)
    .sort((a, b) => getDist(a) - getDist(b));

  const groupByRange = [
    { label: '0–10 mi', min: 0, max: 10 },
    { label: '10–25 mi', min: 10, max: 25 },
    { label: '25–50 mi', min: 25, max: 50 },
  ];

  const renderGroup = (label: string, min: number, max: number) => {
    const group = sortedLeads.filter((l) => {
      const dist = getDist(l);
      return dist >= min && dist < max;
    });
    if (!group.length) return null;

    return (
      <div key={label} className="pt-2">
        <div className="text-xs font-semibold text-zinc-400 mb-1">{label}</div>
        {group.map((lead) => (
          <div key={lead.id} className="flex items-center gap-2 mb-1">
            <input type="checkbox" checked={selectedLeadIds.includes(lead.id)} onChange={() => toggle(lead.id)} />
            <span className="text-sm text-white">
              {lead.business_name}
              <span className="text-zinc-400 ml-1 text-xs">({getDist(lead).toFixed(1)} mi)</span>
            </span>
          </div>
        ))}
      </div>
    );
  };

  const outsideRadius = leads.filter((l) => getDist(l) > radius);

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
            {outsideRadius.map((lead) => (
              <div key={lead.id} className="flex items-center gap-2 mb-1">
                <input type="checkbox" checked={selectedLeadIds.includes(lead.id)} onChange={() => toggle(lead.id)} />
                <span className="text-sm text-white">
                  {lead.business_name}
                  <span className="text-zinc-400 ml-1 text-xs">(outside radius)</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
