// components/admin/campaigns/edit-campaign-modal.tsx
'use client';

import { Lead } from '@/types/lead.types';
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
  currentCampaignId?: string | null;
  currentCampaignExpiresAt?: string | null;
};

export default function EditCampaignModal(props: Props) {
  const {
    campaign,
    allLeads,
    selectedLeadIds,
    setSelectedLeadIds,
    leadsByCampaign,
    setEditingCampaign,
    geoCenter,
    currentCampaignId,
    currentCampaignExpiresAt,
  } = props;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditingCampaign(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);
  const [radius, setRadius] = useState(50);
  const [availableIndustries, setAvailableIndustries] = useState<string[]>([]);
  const [campaignIndustry, setCampaignIndustry] = useState(campaign.industry || '');
  const [campaignState, setCampaignState] = useState(campaign.state || '');
  const [campaignCity, setCampaignCity] = useState(campaign.city || '');
  const [campaignStatus, setCampaignStatus] = useState<CampaignType['status']>(campaign.status || 'draft');
  const [cityLat, setCityLat] = useState<number | null>(campaign.city_lat ?? null);
  const [cityLon, setCityLon] = useState<number | null>(campaign.city_lon ?? null);
  // Editable fields kept in state — the inputs previously mutated the `campaign`
  // prop directly, which never re-rendered (typing appeared frozen).
  const [name, setName] = useState<string>(campaign.name || '');
  const [startsAt, setStartsAt] = useState<string>(campaign.starts_at as any);
  const [endsAt, setEndsAt] = useState<string>(campaign.ends_at as any);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // fetch industries
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

  // sync lat lon
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

  // sync campaign state
  useEffect(() => {
    setCampaignState(campaign.state || '');
    setCampaignIndustry(campaign.industry || '');
    setCampaignCity(campaign.city || '');
    setCampaignStatus(campaign.status || 'draft');
    setCityLat(campaign.city_lat ?? null);
    setCityLon(campaign.city_lon ?? null);
    setName(campaign.name || '');
    setStartsAt(campaign.starts_at as any);
    setEndsAt(campaign.ends_at as any);
  }, [campaign]);

  // fetch linked leads
  useEffect(() => {
    async function fetchLinkedLeads() {
      if (!campaign?.id) return;
  
      const res = await fetch(`/api/campaigns/${campaign.id}/leads`);
      const json = await res.json();
  
      if (res.ok && Array.isArray(json.lead_ids)) {
        setSelectedLeadIds(json.lead_ids);
      } else {
        console.warn('Failed to fetch campaign-linked leads:', json.error || json);
      }
    }
  
    fetchLinkedLeads();
  }, [campaign?.id]);

  // filter leads by industry
  const filteredLeads = useMemo(() => {
    const leads = campaignIndustry
      ? allLeads.filter((l) => l.industry?.toLowerCase().trim() === campaignIndustry.toLowerCase().trim())
      : allLeads;
    return leads;
  }, [allLeads, campaignIndustry]);

  // count leads by radius
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
      <div className="bg-zinc-900 text-white p-6 rounded shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto relative">
        <h2 className="text-lg font-bold mb-4">Edit Campaign</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (submitting) return;
            setSubmitting(true);
            setSubmitError(null);
            try {
              const res = await fetch('/api/campaigns/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: campaign.id,
                  name,
                  city: campaignCity,
                  state: campaignState,
                  city_lat: cityLat,
                  city_lon: cityLon,
                  starts_at: startsAt,
                  ends_at: endsAt,
                  lead_ids: selectedLeadIds,
                  industry: campaignIndustry,
                  status: campaignStatus,
                }),
              });

              const json = await res.json().catch(() => ({}));
              if (!res.ok || json.error) {
                setSubmitError(json.error || `Failed to save (${res.status}).`);
                return;
              }

              // Parent refetches on close (no full-page reload needed).
              setEditingCampaign(null);
            } catch (err: any) {
              setSubmitError(err?.message || 'Network error while saving.');
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <label className="block mb-3">
            Name:
            <input
              className="mt-1 w-full px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              selected={startsAt ? dayjs(startsAt).toDate() : null}
              onChange={(date) => setStartsAt(dayjs(date).toISOString())}
              showTimeSelect
              dateFormat="Pp"
            />
          </label>
          <label className="block mb-3">
            Ends At:
            <DatePicker
              className="mt-1 w-full px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-white"
              selected={endsAt ? dayjs(endsAt).toDate() : null}
              onChange={(date) => setEndsAt(dayjs(date).toISOString())}
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
              currentCampaignId={campaign.id}
              currentCampaignExpiresAt={campaign.ends_at}
            />
          </div>

          {submitError && (
            <div className="mb-3 rounded border border-red-600/50 px-2 py-1 text-sm text-red-400">⚠️ {submitError}</div>
          )}

          <div className="flex justify-end gap-3 sticky bottom-0 bg-zinc-900 pt-3 pb-4 z-10">
            <button
              type="button"
              disabled={submitting}
              className="text-sm text-zinc-400 hover:underline disabled:opacity-60"
              onClick={() => setEditingCampaign(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
