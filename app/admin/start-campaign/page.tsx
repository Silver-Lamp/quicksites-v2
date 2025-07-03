// app/admin/start-campaign/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCampaignForm } from '@/hooks/useCampaignForm';

export default function StartCampaign() {
  const searchParams = useSearchParams();

  const cityParam = searchParams?.get('city') || '';
  const stateParam = searchParams?.get('state') || '';
  const industryParam = searchParams?.get('industry') || '';
  const leadIdsParam = searchParams?.get('leadIds') || '';
  const initialLeadIds = searchParams?.get('initialLeadIds')?.split(',').filter(Boolean) || [];

  const [city, setCity] = useState(cityParam);
  const [state, setState] = useState(stateParam);
  const [industry, setIndustry] = useState(industryParam);

  const {
    name,
    setName,
    nameWasManuallySet,
    setNameWasManuallySet,
    alt1,
    alt2,
    setAlt1,
    setAlt2,
    startsAt,
    setStartsAt,
    endsAt,
    setEndsAt,
    silentMode,
    setSilentMode,
    error,
    validationErrors,
    submit,
    leads,
    selectedLeads,
    // setSelectedLeads,
    toggleLead,
    leadsLoading,
    initialLeadIds: initialLeadIdsFromParams,
  } = useCampaignForm(city, state, initialLeadIds);

  // Optional: auto-generate campaign name
  useEffect(() => {
    if (!nameWasManuallySet && city) {
      setName(`${city} Campaign`);
    }
  }, [city, nameWasManuallySet]);

  // Sync selected leads once leads are loaded
  useEffect(() => {
    if (initialLeadIds.length && leads.length) {
      const validIds = leads
        .map((l) => l.id)
        .filter((id) => initialLeadIds.includes(id));
      // setSelectedLeads(validIds);
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
        {validationErrors.name && <p className="text-sm text-red-400">{validationErrors.name}</p>}

        <div className="flex gap-4">
          <input
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
          />
          <input
            placeholder="State"
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
          />
        </div>

        <input
          placeholder="Industry"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
        />

        <div className="space-y-2">
          <p className="text-sm font-semibold">Select at least 2 Leads</p>
          {leads.map((lead) => (
            <label key={lead.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedLeads.includes(lead.id)}
                onChange={() => toggleLead(lead.id)}
              />
              <span>{lead.business_name}</span>
            </label>
          ))}
          {validationErrors.leads && (
            <p className="text-sm text-red-400">{validationErrors.leads}</p>
          )}
        </div>

        <div className="flex gap-4">
          <input
            placeholder="Alt Domain 1"
            value={alt1}
            onChange={(e) => setAlt1(e.target.value)}
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
          />
          <input
            placeholder="Alt Domain 2"
            value={alt2}
            onChange={(e) => setAlt2(e.target.value)}
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
        {validationErrors.dates && <p className="text-sm text-red-400">{validationErrors.dates}</p>}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={silentMode}
            onChange={(e) => setSilentMode(e.target.checked)}
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
