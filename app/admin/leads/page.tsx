// app/admin/leads/page.tsx
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';
import { createLeadFromPhoto } from '@/lib/leads/photoProcessor';
import type { Lead } from '@/types/lead.types';
import Papa from 'papaparse';
import Image from 'next/image';
import LeadsTable from '@/components/admin/leads-table';

const CONFIDENCE_THRESHOLD = 0.85;
const LEADS_PER_PAGE = 20;

export default function LeadsPage() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  useEffect(() => {
    if (toastMessage) {
      const timeout = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timeout);
    }
  }, [toastMessage]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [summary, setSummary] = useState({ total: 0, matchedDomains: 0, matchedCampaigns: 0, duplicates: 0 });
  const [nextAction, setNextAction] = useState(false);
  const [error, setError] = useState('');
  const [sortField, setSortField] = useState<'created_at' | 'address_city'>('created_at');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const currentPageRef = useRef(0);

  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [reviewLead, setReviewLead] = useState<any | null>(null);
  const [reviewImage, setReviewImage] = useState<string | null>(null);
  const [editingLeadId, setEditingLeadId] = useState<number | null>(null);
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');

  const fetchTotalCount = useCallback(async () => {
    const { count } = await supabase.from('leads').select('*', { count: 'exact', head: true });
    if (typeof count === 'number') setTotalCount(count);
  }, []);

  const fetchLeads = useCallback(async (reset = false) => {
    if (!reset && !hasMore) return;
    setLoading(true);

    let query = supabase
      .from('leads')
      .select('*')
      .order(sortField, { ascending: sortField === 'address_city' });

    if (filterSource !== 'all') query = query.eq('source', filterSource);
    if (filterStatus !== 'all') query = query.eq('status', filterStatus);

    const from = reset ? 0 : currentPageRef.current * LEADS_PER_PAGE;
    const to = from + LEADS_PER_PAGE - 1;
    const { data, error } = await query.range(from, to);

    if (data) {
      data.forEach((lead, index) => {
        try {
          if (!lead.business_name || typeof lead.business_name !== 'string') {
            console.warn(`[Lead Skipped] Row ${from + index} (id: ${lead.id}): Invalid business_name`, lead);
            lead.business_name = '[INVALID LEAD]';
          }
        } catch (e) {
          console.error(`[Lead Error] Row ${from + index} (id: ${lead.id}):`, e, lead);
        }
      });
    }

    if (error) {
      console.error('Error fetching leads:', error);
      setLoading(false);
      return;
    }

    if (!data || data.length < LEADS_PER_PAGE) {
      setHasMore(false);
    }

    if (reset) {
      setLeads(data || []);
      currentPageRef.current = 1;
    } else {
      setLeads((prev) => [...prev, ...(data || [])]);
      currentPageRef.current += 1;
    }

    setLoading(false);
  }, [filterSource, filterStatus, sortField, hasMore]);

  useEffect(() => {
    fetchLeads(true);
    fetchTotalCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loading && hasMore) {
        fetchLeads();
      }
    });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [loaderRef.current, loading, hasMore, fetchLeads]);

  const processFile = async (file: File) => {
    const preview = URL.createObjectURL(file);
    setReviewImage(preview);

    const photoPath = `leads/photos/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('leads').upload(photoPath, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      alert('Failed to upload photo');
      return;
    }

    const photoUrl = supabase.storage.from('leads').getPublicUrl(photoPath).data.publicUrl;

    const { leadData, confidence }: { leadData: any; confidence: number } = await createLeadFromPhoto(file);
    leadData.id = crypto.randomUUID();
    leadData.confidence = confidence || 0;
    leadData.photo_url = photoUrl || null;
    leadData.status = 'reviewed';
    leadData.address_street = null;
    leadData.address_zip = null;
    leadData.address_country = null;

    if (confidence >= CONFIDENCE_THRESHOLD) {
      await supabase.from('leads').insert([leadData]);
      fetchLeads();
      fetchTotalCount();
    } else {
      setReviewLead({ ...leadData, confidence });
    }
  };

  const saveReviewedLead = async () => {
    if (!reviewLead) return;
    const reviewedCopy = { ...reviewLead };
    if (!reviewedCopy.status) reviewedCopy.status = 'needs_review';
    await supabase.from('leads').insert([reviewedCopy]);
    setReviewLead(null);
    setReviewImage(null);
    fetchLeads();
    fetchTotalCount();
  };

  const dedupedLeads = Array.from(new Map(leads.map((l) => [l.id, l])).values());
  const filteredLeads = dedupedLeads.filter((l) =>
    l.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.address_city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Upload + Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Upload Photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
            className="hidden"
          />
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Search business name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-2 py-1 bg-gray-900 text-white placeholder-gray-400 border-gray-700 focus:ring-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 shadow-sm focus:shadow-md transition duration-200"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-sm text-blue-600 underline"
            >
              Clear
            </button>
          )}
          <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="border rounded px-2 py-1 bg-gray-900 text-white placeholder-gray-400 border-gray-700 focus:ring-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 shadow-sm focus:shadow-md transition duration-200">
            <option value="all">All Sources</option>
            <option value="photo">Photo</option>
            <option value="csv">CSV</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border rounded px-2 py-1 bg-gray-900 text-white placeholder-gray-400 border-gray-700 focus:ring-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 shadow-sm focus:shadow-md transition duration-200">
            <option value="all">All Statuses</option>
            <option value="reviewed">Reviewed</option>
            <option value="needs_review">Needs Review</option>
            <option value="duplicate">Duplicate</option>
          </select>
          <span className="text-sm text-gray-600">
            Showing {filteredLeads.length} of {leads.length} loaded / {totalCount} total
          </span>
        </div>
      </div>

      {/* Review Panel */}
      {reviewLead && reviewImage && (
        <div className="p-4 bg-yellow-50 rounded border border-yellow-300 flex gap-6 items-start">
          <Image src={reviewImage} alt="Lead preview" width={300} height={200} className="rounded" />
          <div className="flex-1">
            <h3 className="text-lg font-bold mb-2">Review Extracted Info</h3>
            <pre className="bg-white border p-2 rounded text-sm overflow-x-auto">
              {JSON.stringify(reviewLead, null, 2)}
            </pre>
            <div className="flex gap-4 mt-4">
              <button onClick={saveReviewedLead} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                Save Lead
              </button>
              <button
                onClick={() => { setReviewLead(null); setReviewImage(null); }}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leads Table */}
      <LeadsTable leads={filteredLeads} setEditingLead={setEditingLead} setSelectedIds={setSelectedIds} />

      {toastMessage && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded shadow-lg z-50 animate-fade-in">
          {toastMessage}
        </div>
      )}

      {editingLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-gray-900 text-white p-6 rounded shadow-lg w-full max-w-md animate-fade-in">
            <h2 className="text-xl font-bold mb-4">Edit Lead</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editingLead.business_name || !editingLead.address_city) {
                  setToastMessage('Business name and city are required.')
                  return;
                }
                supabase
                  .from('leads')
                  .update({
                    business_name: editingLead.business_name,
                    address_city: editingLead.address_city,
                    status: editingLead.status,
                    industry: editingLead.industry,
                  })
                  .eq('id', editingLead.id)
                  .then(({ error }) => {
                    if (!error) {
                      setToastMessage('Lead updated.')
                      setEditingLead(null);
                      fetchLeads(true);
                    }
                  });
              }}
              // onKeyDown={async (e: React.KeyboardEvent<HTMLFormElement>) => {
              //   e.preventDefault();
              //   if (!editingLead.business_name || !editingLead.address_city) return;
              //   const { error } = await supabase
              //     .from('leads')
              //     .update({
              //       business_name: editingLead.business_name,
              //       address_city: editingLead.address_city,
              //       status: editingLead.status,
              //       industry: editingLead.industry,
              //     })
              //     .eq('id', editingLead.id);

              //   if (!error) {
              //     setEditingLead(null);
              //     fetchLeads(true);
              //   }
              // }}
            >
              <label className="block mb-2">
                Business Name:
                <input
                  autoFocus
                  required
                  value={editingLead.business_name || ''}
                  onChange={(e) =>
                    setEditingLead({ ...editingLead, business_name: e.target.value })
                  }
                  className="mt-1 block w-full border rounded px-2 py-1 bg-gray-800 text-white placeholder-gray-400 border-gray-700 focus:ring-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 shadow-sm focus:shadow-md transition duration-200"
                />
              </label>
              <label className="block mb-2">
                City:
                <input
                  required
                  value={editingLead.address_city || ''}
                  onChange={(e) =>
                    setEditingLead({ ...editingLead, address_city: e.target.value })
                  }
                  className="mt-1 block w-full border rounded px-2 py-1 bg-gray-800 text-white placeholder-gray-400 border-gray-700 focus:ring-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 shadow-sm focus:shadow-md transition duration-200"
                />
              </label>
              <label className="block mb-2">
                Status:
                <select
                  value={editingLead.status || ''}
                  onChange={(e) =>
                    setEditingLead({ ...editingLead, status: e.target.value })
                  }
                  className="mt-1 block w-full border rounded px-2 py-1 bg-gray-800 text-white placeholder-gray-400 border-gray-700 focus:ring-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 shadow-sm focus:shadow-md transition duration-200"
                >
                  <option value="">--</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="needs_review">Needs Review</option>
                  <option value="duplicate">Duplicate</option>
                </select>
              </label>
              <label className="block mb-2">
                Industry:
                <input
                  value={editingLead.industry || ''}
                  onChange={(e) =>
                    setEditingLead({ ...editingLead, industry: e.target.value })
                  }
                  className="mt-1 block w-full border rounded px-2 py-1 bg-gray-800 text-white placeholder-gray-400 border-gray-700 focus:ring-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 shadow-sm focus:shadow-md transition duration-200"
                />
              </label>
              <div className="flex justify-between items-center gap-4 mt-4">
                <button
                  type="button"
                  onClick={async () => {
                    const { error } = await supabase.from('leads').delete().eq('id', editingLead.id);
                    if (!error) setToastMessage('Lead deleted.')
                    setEditingLead(null);
                    fetchLeads(true);
                    fetchTotalCount();
                  }}
                  className="text-red-600 hover:underline text-sm"
                >
                  Delete
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingLead(null)}
                    className="text-gray-300 hover:underline"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Save
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loader */}
      <div ref={loaderRef} className="text-center text-sm py-6 text-gray-400">
        {loading ? 'Loading more leads…' : hasMore ? 'Scroll down to load more' : 'No more leads to load.'}
      </div>
    </div>
  );
}
