// components/admin/campaigns/EditCampaignModal.tsx
'use client';

import { Campaign, Lead } from '@/app/admin/campaigns/page';
import { Dispatch, SetStateAction } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { getDistanceMiles } from '@/lib/utils/distance';
import dayjs from 'dayjs';
import { useState } from 'react';

type Props = {
  campaign: Campaign;
  allLeads: Lead[];
  selectedLeadIds: string[];
  setSelectedLeadIds: Dispatch<SetStateAction<string[]>>;
  leadsByCampaign: Record<string, Lead[]>;
  setEditingCampaign: (c: Campaign | null) => void;
};

export default function EditCampaignModal({
  campaign,
  allLeads,
  selectedLeadIds,
  setSelectedLeadIds,
  leadsByCampaign,
  setEditingCampaign,
}: Props) {
  const campaignIndustry = leadsByCampaign[campaign.id]?.[0]?.industry;
  const filteredLeads = allLeads.filter((l) => l.industry === campaignIndustry);


  const [radius, setRadius] = useState(50);

  const filteredByRadius = filteredLeads.filter((l) => {
    if (!l.address_lat || !l.address_lon || !campaign.city_lat || !campaign.city_lon) return false;
    const dist = getDistanceMiles(
      l.address_lat,
      l.address_lon,
      campaign.city_lat,
      campaign.city_lon
    );
    return dist <= radius;
  });

  const sortedLeads = [...filteredByRadius].sort((a, b) => {
    const aDist = getDistanceMiles(
      a.address_lat!,
      a.address_lon!,
      campaign.city_lat!,
      campaign.city_lon!
    );
    const bDist = getDistanceMiles(
      b.address_lat!,
      b.address_lon!,
      campaign.city_lat!,
      campaign.city_lon!
    );
    return aDist - bDist;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-zinc-900 text-white p-6 rounded shadow-xl w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">Edit Campaign</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const { error } = await fetch(`/api/campaigns/update`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...campaign, lead_ids: selectedLeadIds }),
            }).then((r) => r.json());
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
              value={campaign.name}
              onChange={(e) => campaign.name = e.target.value}
            />
          </label>
          <label className="block mb-3">
            City:
            <input
              className="mt-1 w-full px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-white"
              value={campaign.city}
              onChange={(e) => campaign.city = e.target.value}
            />
          </label>
          <label className="block mb-3">
            Starts At:
            <DatePicker
              className="mt-1 w-full px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-white"
              selected={dayjs(campaign.starts_at).toDate()}
              onChange={(date) => campaign.starts_at = dayjs(date).toISOString()}
              showTimeSelect
              dateFormat="Pp"
            />
          </label>
          <label className="block mb-3">
            Ends At:
            <DatePicker
              className="mt-1 w-full px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-white"
              selected={dayjs(campaign.ends_at).toDate()}
              onChange={(date) => campaign.ends_at = dayjs(date).toISOString()}
              showTimeSelect
              dateFormat="Pp"
            />
          </label>
          <label className="block mb-4">
            Link Leads:
            <div className="mb-2">
              <label className="text-xs text-zinc-400 mr-2">Radius Filter:</label>
              <select
                className="text-sm bg-zinc-800 text-white border border-zinc-700 rounded px-2 py-1"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
              >
                {[10, 25, 50, 100].map((r) => (
                  <option key={r} value={r}>{`Within ${r} miles`}</option>
                ))}
              </select>
            </div>
            <div className="max-h-64 overflow-y-auto rounded border border-zinc-700 p-2 bg-zinc-800 divide-y divide-zinc-700">
              {['0-10 mi', '10-25 mi', '25-50 mi'].map((range) => {
                const [min, max] = range.split(' mi')[0].split('-').map(Number);
                const group = sortedLeads.filter((l) => {
                  const dist = getDistanceMiles(
                    l.address_lat!,
                    l.address_lon!,
                    campaign.city_lat!,
                    campaign.city_lon!
                  );
                  const inBand = dist >= min && dist < max;
                  return inBand;
                });
                if (group.length === 0) return null;
                return (
                  <div key={range} className="pt-2">
                    <div className="text-xs font-semibold text-zinc-400 mb-1">{range}</div>
                    {group.map((lead) => (
                      <div key={lead.id} className="flex items-center gap-2 mb-1">
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
                        <span className="text-sm text-white">
                          {lead.business_name}
                          <span className="text-zinc-400 ml-1 text-xs">
                            ({getDistanceMiles(
                              lead.address_lat!,
                              lead.address_lon!,
                              campaign.city_lat!,
                              campaign.city_lon!
                            ).toFixed(1)} mi)
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
              <div className="pt-4">
                <div className="text-xs font-semibold text-zinc-400 mb-1">Other Leads</div>
                {filteredLeads
                  .filter((l) => !l.address_lat || !l.address_lon || !campaign.city_lat || !campaign.city_lon || getDistanceMiles(l.address_lat, l.address_lon, campaign.city_lat, campaign.city_lon) > radius)
                  .map((lead) => (
                    <div key={lead.id} className="flex items-center gap-2 mb-1">
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
                      <span className="text-sm text-white">
                        {lead.business_name}
                        <span className="text-zinc-400 ml-1 text-xs">(outside radius)</span>
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </label>
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
  );
}
