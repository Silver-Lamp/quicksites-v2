// components/admin/campaigns/edit-campaign-modal.tsx
'use client';

import { Campaign, Lead } from '@/app/admin/campaigns/page';
import { Dispatch, SetStateAction, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import dayjs from 'dayjs';
import LeadSelectorWithRadius from '@/components/admin/campaigns/lead-selector-with-radius';

export type Props = {
  campaign: Campaign;
  allLeads: Lead[];
  selectedLeadIds: string[];
  setSelectedLeadIds: Dispatch<SetStateAction<string[]>>;
  leadsByCampaign: Record<string, Lead[]>;
  setEditingCampaign: (c: Campaign | null) => void;
  geoCenter?: { lat: number; lon: number } | null;
};

export default function EditCampaignModal({
  campaign,
  allLeads,
  selectedLeadIds,
  setSelectedLeadIds,
  leadsByCampaign,
  setEditingCampaign,
  geoCenter,
}: Props) {
  const [radius, setRadius] = useState(50);
  const campaignIndustry = leadsByCampaign[campaign.id]?.[0]?.industry;
  const filteredLeads = allLeads.filter((l) => l.industry === campaignIndustry);

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
              onChange={(e) => (campaign.name = e.target.value)}
            />
          </label>
          <label className="block mb-3">
            City:
            <input
              className="mt-1 w-full px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-white"
              value={campaign.city}
              onChange={(e) => (campaign.city = e.target.value)}
            />
          </label>
          <label className="block mb-3">
            Starts At:
            <DatePicker
              className="mt-1 w-full px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-white"
              selected={dayjs(campaign.starts_at).toDate()}
              onChange={(date) => (campaign.starts_at = dayjs(date).toISOString())}
              showTimeSelect
              dateFormat="Pp"
            />
          </label>
          <label className="block mb-3">
            Ends At:
            <DatePicker
              className="mt-1 w-full px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-white"
              selected={dayjs(campaign.ends_at).toDate()}
              onChange={(date) => (campaign.ends_at = dayjs(date).toISOString())}
              showTimeSelect
              dateFormat="Pp"
            />
          </label>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Link Leads:</label>
            <LeadSelectorWithRadius
              leads={filteredLeads}
              selectedLeadIds={selectedLeadIds}
              setSelectedLeadIds={setSelectedLeadIds}
              cityLat={campaign.city_lat}
              cityLon={campaign.city_lon}
              radius={radius}
              setRadius={setRadius}
            />
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
  );
}
