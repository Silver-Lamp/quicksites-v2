// components/admin/campaigns/edit-campaign-modal.tsx
'use client';

import { Lead } from '@/app/admin/campaigns/page';
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import dayjs from 'dayjs';
import LeadSelectorWithRadius from '@/components/admin/campaigns/lead-selector-with-radius';
import { getDistanceMiles } from '@/lib/utils/distance';
import { CampaignType } from '@/types/campaign.types';
import { getLatLonForCityState } from '@/lib/utils/geocode';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
  'VA', 'WA', 'WV', 'WI', 'WY'
];

export type Props = {
  campaign: CampaignType;
  allLeads: Lead[];
  selectedLeadIds: string[];
  setSelectedLeadIds: Dispatch<SetStateAction<string[]>>;
  leadsByCampaign: Record<string, Lead[]>;
  setEditingCampaign: (c: CampaignType | null) => void;
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
  const [availableIndustries, setAvailableIndustries] = useState<string[]>([]);
  const [campaignIndustry, setCampaignIndustry] = useState(campaign.industry || '');
  const [campaignState, setCampaignState] = useState(campaign.state || '');
  const [campaignCity, setCampaignCity] = useState(campaign.city || '');
  const [campaignStatus, setCampaignStatus] = useState<CampaignType['status']>(campaign.status || 'draft');
  const [cityLat, setCityLat] = useState<number | null>(campaign.city_lat ?? null);
  const [cityLon, setCityLon] = useState<number | null>(campaign.city_lon ?? null);

  useEffect(() => {
    async function fetchIndustries() {
      try {
        const res = await fetch('/api/industries');
        const data = await res.json();
        if (Array.isArray(data)) {
          setAvailableIndustries(data.sort());
        }
      } catch (err) {
        console.error('Failed to load industries:', err);
      }
    }
    fetchIndustries();
  }, []);

  useEffect(() => {
    async function syncLatLon() {
      if (campaignCity && campaignState) {
        const coords = await getLatLonForCityState(campaignCity, campaignState);
        if (coords) {
          setCityLat(coords.lat);
          setCityLon(coords.lon);
        }
      }
    }
    syncLatLon();
  }, [campaignCity, campaignState]);

  useEffect(() => {
    setCampaignState(campaign.state || '');
    setCampaignIndustry(campaign.industry || '');
    setCampaignCity(campaign.city || '');
    setCampaignStatus(campaign.status || 'draft');
    setCityLat(campaign.city_lat ?? null);
    setCityLon(campaign.city_lon ?? null);
  }, [campaign]);

  const filteredLeads = useMemo(() => {
    const leads = campaignIndustry
      ? allLeads.filter((l) => l.industry?.toLowerCase().trim() === campaignIndustry.toLowerCase().trim())
      : allLeads;
    return leads;
  }, [allLeads, campaignIndustry]);

  const leadCountByRadius = useMemo(() => {
    if (!cityLat || !cityLon) return {};
    return {
      '0–10 mi': filteredLeads.filter((l) => getDistanceMiles(l.address_lat!, l.address_lon!, cityLat, cityLon) < 10).length,
      '10–25 mi': filteredLeads.filter((l) => {
        const d = getDistanceMiles(l.address_lat!, l.address_lon!, cityLat, cityLon);
        return d >= 10 && d < 25;
      }).length,
      '25–50 mi': filteredLeads.filter((l) => {
        const d = getDistanceMiles(l.address_lat!, l.address_lon!, cityLat, cityLon);
        return d >= 25 && d < 50;
      }).length,
    };
  }, [filteredLeads, cityLat, cityLon]);

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-zinc-900 text-white p-6 rounded shadow-xl w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">Edit Campaign</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const res = await fetch('/api/campaigns/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                id: campaign.id,
                name: campaign.name,
                city: campaignCity,
                state: campaignState,
                city_lat: cityLat,
                city_lon: cityLon,
                starts_at: campaign.starts_at,
                ends_at: campaign.ends_at,
                lead_ids: selectedLeadIds,
                industry: campaignIndustry,
                status: campaignStatus,
              }),
              });

              const payload = {
                id: campaign.id,
                name: campaign.name,
                city: campaignCity,
                state: campaignState,
                city_lat: cityLat,
                city_lon: cityLon,
                starts_at: campaign.starts_at,
                ends_at: campaign.ends_at,
                lead_ids: selectedLeadIds,
                industry: campaignIndustry,
                status: campaignStatus,
              };

              console.log('[📤 Saving Campaign]', payload);
              const json = await res.json();
              if (json.updated) {
                console.log('[✅ Updated from server]', json.updated);
                setCampaignState(json.updated.state || '');
                setCampaignIndustry(json.updated.industry || '');
                setCampaignCity(json.updated.city || '');
                setCampaignStatus(json.updated.status || 'draft');
                setCityLat(json.updated.city_lat ?? null);
                setCityLon(json.updated.city_lon ?? null);
              }

              if (!res.ok || json.error) {
                console.error('❌ Update failed:', json.error || 'Unknown error');
                return;
              }

              setEditingCampaign(null);
              location.reload();
            } catch (err) {
              console.error('❌ Network error while updating campaign:', err);
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
              value={campaignCity}
              onChange={(e) => setCampaignCity(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="block mb-3">
            State:
            <span className="ml-2 text-xs text-zinc-400">[DB: {campaign.state}]</span>
            <select
              className="mt-1 w-full px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-white"
              value={campaignState}
              onChange={(e) => setCampaignState(e.target.value)}
            >
              <option value="">Select State</option>
              {US_STATES.map((abbr) => (
                <option key={abbr} value={abbr}>
                  {abbr}
                </option>
              ))}
            </select>
          </label>
          <label className="block mb-3">
            Status:
            <select
              className="mt-1 w-full px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-white"
              value={campaignStatus}
              onChange={(e) => setCampaignStatus(e.target.value as CampaignType['status'])}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>

          <label className="block mb-3">
            Industry:
            <span className="ml-2 text-xs text-zinc-400">[DB: {campaign.industry}]</span>
            <select
              className="mt-1 w-full px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-white"
              value={campaignIndustry}
              onChange={(e) => setCampaignIndustry(e.target.value)}
            >
              <option value="">Select Industry</option>
              {availableIndustries.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
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
            <label className="block text-sm font-medium mb-1">
              Link Leads:
              <div className="text-xs text-zinc-400 mt-1">
                0–10 mi: {leadCountByRadius['0–10 mi']} • 10–25 mi: {leadCountByRadius['10–25 mi']} • 25–50 mi: {leadCountByRadius['25–50 mi']}
              </div>
            </label>
            <LeadSelectorWithRadius
              leads={filteredLeads}
              selectedLeadIds={selectedLeadIds}
              setSelectedLeadIds={setSelectedLeadIds}
              cityLat={cityLat}
              cityLon={cityLon}
              radius={radius}
              setRadius={setRadius}
              industry={campaignIndustry}
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
        <details className="mt-4 text-xs text-zinc-400 bg-zinc-800 p-2 rounded border border-zinc-700">
  <summary className="cursor-pointer select-none">Debug: Loaded Campaign Object</summary>
  <pre className="whitespace-pre-wrap text-xs mt-2">
    {JSON.stringify(campaign, null, 2)}
  </pre>
</details>
</form>
      </div>
    </div>
  );
}
