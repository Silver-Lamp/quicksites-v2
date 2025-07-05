'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCampaignForm } from '@/hooks/useCampaignForm';
import { useSelectedLeadsWrapper } from '@/hooks/useSelectedLeadsWrapper';
import { useRadiusFilter } from '@/hooks/useRadiusFilter';
import { useSavedCampaignDraft } from '@/hooks/useSavedCampaignDraft';
import LeadSelectorWithRadius from '@/components/admin/campaigns/lead-selector-with-radius';
import { getLatLonForCityState } from '@/lib/utils/geocode';
import { Lead } from '@/types/lead.types';

export default function StartCampaign() {
  const searchParams = useSearchParams();

  const cityParam = searchParams?.get('city') || '';
  const stateParam = searchParams?.get('state') || '';
  const industryParam = searchParams?.get('industry') || '';
  const initialLeadIds = searchParams?.get('initialLeadIds')?.split(',').filter(Boolean) || [];

  const [draft, updateDraft, clearDraft] = useSavedCampaignDraft();

  const [city, setCity] = useState(draft.city || cityParam);
  const [state, setState] = useState(draft.state || stateParam);
  const [industry, setIndustry] = useState(draft.industry || industryParam);
  const [alt1, setAlt1] = useState(draft.alt1 || '');
  const [alt2, setAlt2] = useState(draft.alt2 || '');
  const [silentMode, setSilentMode] = useState(draft.silentMode ?? false);
  const [cityLat, setCityLat] = useState<number | null>(null);
  const [cityLon, setCityLon] = useState<number | null>(null);
  const [availableIndustries, setAvailableIndustries] = useState<string[]>([]);

  const {
    name,
    setName,
    nameWasManuallySet,
    setNameWasManuallySet,
    startsAt,
    setStartsAt,
    endsAt,
    setEndsAt,
    error,
    validationErrors,
    submit,
    leads,
    selectedLeads,
    toggleLead,
    leadsLoading,
  } = useCampaignForm(city, state, initialLeadIds);

  const { setSelectedLeadIds } = useSelectedLeadsWrapper(selectedLeads, (id) => {
    toggleLead(id);
    const updated = selectedLeads.includes(id)
      ? selectedLeads.filter((x) => x !== id)
      : [...selectedLeads, id];
    updateDraft({ selectedLeadIds: updated });
  });

  const { radius, setRadius } = useRadiusFilter(50);

  useEffect(() => {
    if (!nameWasManuallySet && city) {
      setName(`${city} Campaign`);
    }
  }, [city, nameWasManuallySet]);

  useEffect(() => {
    async function fetchLatLon() {
      if (city && state) {
        const coords = await getLatLonForCityState(city, state);
        if (coords) {
          setCityLat(coords.lat);
          setCityLon(coords.lon);
        }
      }
    }
    fetchLatLon();
  }, [city, state]);

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

  const filteredLeads: Lead[] = (industry
    ? leads.filter((l) => l.industry === industry)
    : leads) as Lead[];

  useEffect(() => {
    if (!industry && leads.length > 0) {
      const firstWithIndustry = leads.find((l) => l.industry);
      if (firstWithIndustry?.industry) {
        setIndustry(firstWithIndustry.industry);
        updateDraft({ industry: firstWithIndustry.industry });
      }
    }
  }, [leads]);

  return (
    <div className="p-6 max-w-3xl mx-auto text-white">
      <h1 className="text-2xl font-bold mb-4">Start Campaign</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <input
          placeholder="Campaign Name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameWasManuallySet(true);
          }}
          className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
        />

        <div className="flex gap-4">
          <input
            placeholder="City"
            value={city}
            onChange={(e) => {
              const val = e.target.value;
              setCity(val);
              updateDraft({ city: val });
            }}
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
          />
          <input
            placeholder="State"
            value={state}
            onChange={(e) => {
              const val = e.target.value;
              setState(val);
              updateDraft({ state: val });
            }}
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
          />
        </div>

        <select
          value={industry}
          onChange={(e) => {
            const val = e.target.value;
            setIndustry(val);
            updateDraft({ industry: val });
          }}
          className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
        >
          <option value="">Select Industry</option>
          {availableIndustries.map((ind) => (
            <option key={ind} value={ind}>
              {ind}
            </option>
          ))}
        </select>

        {filteredLeads.length > 0 ? (
          <LeadSelectorWithRadius
            leads={filteredLeads}
            selectedLeadIds={selectedLeads}
            setSelectedLeadIds={setSelectedLeadIds}
            cityLat={cityLat}
            cityLon={cityLon}
            radius={radius}
            setRadius={setRadius}
          />
        ) : (
          <p className="text-sm text-zinc-400 border border-zinc-700 rounded p-3 bg-zinc-800">
            No leads found for this location and industry.
          </p>
        )}

        <div className="flex gap-4">
          <input
            placeholder="Alt Domain 1"
            value={alt1}
            onChange={(e) => {
              const val = e.target.value;
              setAlt1(val);
              updateDraft({ alt1: val });
            }}
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
          />
          <input
            placeholder="Alt Domain 2"
            value={alt2}
            onChange={(e) => {
              const val = e.target.value;
              setAlt2(val);
              updateDraft({ alt2: val });
            }}
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
          />
        </div>

        <div className="flex gap-4">
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
          />
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={silentMode}
            onChange={(e) => {
              const checked = e.target.checked;
              setSilentMode(checked);
              updateDraft({ silentMode: checked });
            }}
          />
          Silent Mode (no notifications)
        </label>

        {error && (
          <div className="text-red-400 text-sm border border-red-600 p-2 rounded">⚠️ {error}</div>
        )}

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Launch Campaign
        </button>
      </form>
    </div>
  );
}

StartCampaign.getLayout = function getLayout(page: React.ReactNode) {
  return <>{page}</>;
};
