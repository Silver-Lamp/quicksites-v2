// app/admin/leads/page.tsx
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/admin/lib/supabaseClient';
import { createLeadFromPhoto } from '@/lib/leads/photoProcessor';
import type { Lead } from '@/types/lead.types';
import Papa from 'papaparse';
import Image from 'next/image';
import LeadsTable from '@/components/admin/leads-table';

const CONFIDENCE_THRESHOLD = 0.85;
const LEADS_PER_PAGE = 100;
const ESTIMATED_VALUE_PER_LEAD = 49;

export default function LeadsPage() {
  const router = useRouter();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [industryFilterForBatch, setIndustryFilterForBatch] = useState<string>('all');

  useEffect(() => {
    if (toastMessage) {
      const timeout = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timeout);
    }
  }, [toastMessage]);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');

  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterIndustry, setFilterIndustry] = useState<string>('all');

  const loaderRef = useRef<HTMLDivElement>(null);
  const currentPageRef = useRef(0);

  const fetchLeads = useCallback(async (reset = false) => {
    if (!reset && !hasMore) return;
    setLoading(true);

    let query = supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (filterSource !== 'all') query = query.eq('source', filterSource);
    if (filterStatus !== 'all') query = query.eq('status', filterStatus);
    if (filterIndustry !== 'all') query = query.eq('industry', filterIndustry);

    const from = reset ? 0 : currentPageRef.current * LEADS_PER_PAGE;
    const to = from + LEADS_PER_PAGE - 1;
    const { data, error } = await query.range(from, to);

    if (error) {
      console.error('Error fetching leads:', error);
      setLoading(false);
      return;
    }

    const enriched = (data || []).map((lead) => ({
      ...lead,
      inCampaign: !!lead.current_campaign_id,
    }));

    if (reset) {
      setLeads(enriched);
      currentPageRef.current = 1;
    } else {
      setLeads((prev) => [...prev, ...enriched]);
      currentPageRef.current += 1;
    }

    if (!data || data.length < LEADS_PER_PAGE) setHasMore(false);
    setLoading(false);
  }, [filterSource, filterStatus, filterIndustry, hasMore]);

  const fetchTotalCount = useCallback(async () => {
    const { count } = await supabase.from('leads').select('*', { count: 'exact', head: true });
    if (typeof count === 'number') setTotalCount(count);
  }, []);

  useEffect(() => {
    fetchLeads(true);
    fetchTotalCount();
  }, [filterSource, filterStatus, filterIndustry]);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loading && hasMore) {
        fetchLeads();
      }
    });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [loaderRef.current, loading, hasMore, fetchLeads]);

  const filtered = leads.filter((l) =>
    l.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.address_city?.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce((acc, lead) => {
    const state = lead.address_state || 'Unknown';
    const city = lead.address_city || 'Unknown';
    if (!acc[state]) acc[state] = {};
    if (!acc[state][city]) acc[state][city] = [];
    acc[state][city].push(lead);
    return acc;
  }, {} as Record<string, Record<string, Lead[]>>);

  function startCampaignForCity(city: string, leadsInCity: Lead[]) {
    const leadIds = leadsInCity.map((l) => l.id);
    router.push(`/admin/start-campaign?city=${city}&leadIds=${leadIds.join(',')}`);
  }

  const readyToStart: { city: string; state: string; leads: Lead[] }[] = [];
  for (const [state, cities] of Object.entries(grouped)) {
    for (const [city, leadsInCity] of Object.entries(cities)) {
      if (leadsInCity.length >= 2 && !leadsInCity.some((l) => l.current_campaign_id)) {
        readyToStart.push({ state, city, leads: leadsInCity });
      }
    }
  }

  const filteredReady = readyToStart.filter(({ leads }) =>
    industryFilterForBatch === 'all' || leads.some((l) => l.industry === industryFilterForBatch)
  );

  const totalEstValue = filteredReady.reduce((sum, g) => sum + g.leads.length * ESTIMATED_VALUE_PER_LEAD, 0);

  const batchStartCampaigns = () => {
    const allLeadIds = filteredReady.flatMap(({ leads }) => leads.map((l) => l.id));
    router.push(`/admin/start-campaign?leadIds=${allLeadIds.join(',')}`);
  };

  readyToStart.sort((a, b) => b.leads.length - a.leads.length);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Search business or city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-2 py-1 rounded bg-gray-900 text-white border border-gray-700"
        />
        <select value={filterIndustry} onChange={(e) => setFilterIndustry(e.target.value)} className="px-2 py-1 rounded bg-gray-900 text-white border border-gray-700">
          <option value="all">All Industries</option>
          <option value="towing">Towing</option>
          <option value="concrete">Concrete</option>
        </select>
        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="px-2 py-1 rounded bg-gray-900 text-white border border-gray-700">
          <option value="all">All Sources</option>
          <option value="photo">Photo</option>
          <option value="csv">CSV</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-2 py-1 rounded bg-gray-900 text-white border border-gray-700">
          <option value="all">All Statuses</option>
          <option value="reviewed">Reviewed</option>
          <option value="needs_review">Needs Review</option>
        </select>
        <span className="text-sm text-gray-400">
          Showing {filtered.length} / {totalCount} total
        </span>
      </div>

      {filteredReady.length > 0 && (
        <div className="bg-gray-800 p-4 rounded border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-green-400">Campaigns Ready to Start</h2>
            <div className="flex gap-4 items-center">
              <select
                value={industryFilterForBatch}
                onChange={(e) => setIndustryFilterForBatch(e.target.value)}
                className="text-sm bg-gray-900 text-white border border-gray-700 rounded px-2 py-1"
              >
                <option value="all">All Industries</option>
                <option value="towing">Towing</option>
                <option value="concrete">Concrete</option>
              </select>
              <button
                onClick={() => setShowConfirm(true)}
                className="text-green-400 text-sm hover:underline"
              >
                ➕ Start All ({filteredReady.length})
              </button>
            </div>
          </div>
          <ul className="space-y-1">
            {filteredReady.map(({ state, city, leads }) => (
              <li key={`${state}-${city}`} className="flex justify-between items-center">
                <span>{city}, {state} ({leads.length} leads)</span>
                <button
                  className="text-green-400 hover:underline text-sm"
                  onClick={() => startCampaignForCity(city, leads)}
                >
                  ➕ Start
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-gray-900 text-white p-6 rounded shadow-lg max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Confirm Campaign Launch</h3>
            <p className="mb-4">
              You are about to start <strong>{filteredReady.length}</strong> campaigns with an estimated value of <strong>${totalEstValue}</strong>. Proceed?
            </p>
            <div className="flex justify-end gap-4">
              <button onClick={() => setShowConfirm(false)} className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600">Cancel</button>
              <button onClick={batchStartCampaigns} className="px-4 py-2 bg-green-600 rounded hover:bg-green-700">Yes, Start</button>
            </div>
          </div>
        </div>
      )}

      {Object.entries(grouped).map(([state, cities]) => (
        <div key={state} className="mt-6">
          <h2 className="text-xl text-blue-400 font-semibold">{state}</h2>
          {Object.entries(cities).map(([city, leadsInCity]) => (
            <div key={city} className="mt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg text-blue-300">{city} ({leadsInCity.length})</h3>
                {leadsInCity.length >= 2 && !leadsInCity.some((l) => l.current_campaign_id) && (
                  <button
                    className="text-green-500 text-sm hover:underline"
                    onClick={() => startCampaignForCity(city, leadsInCity)}
                  >
                    ➕ Start Campaign in {city}
                  </button>
                )}
              </div>
              <LeadsTable leads={leadsInCity} />
            </div>
          ))}
        </div>
      ))}

      <div ref={loaderRef} className="text-center text-sm py-6 text-gray-400">
        {loading ? 'Loading more leads…' : hasMore ? 'Scroll to load more' : 'No more leads to load.'}
      </div>

      {toastMessage && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded shadow-lg z-50">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
