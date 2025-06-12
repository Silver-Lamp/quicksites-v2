import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Papa from 'papaparse';
import type { CSVLeadRow, Lead } from '@/types/lead.types';
import { createLeadFromPhoto } from '@/lib/leads/photoProcessor';

const CONFIDENCE_THRESHOLD = 0.85;
const LEADS_PER_PAGE = 20;

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [summary, setSummary] = useState({ total: 0, matchedDomains: 0, matchedCampaigns: 0, duplicates: 0 });
  const [nextAction, setNextAction] = useState(false);
  const [error, setError] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [reviewLead, setReviewLead] = useState<any | null>(null);
  const [reviewImage, setReviewImage] = useState<string | null>(null);
  const [editingLeadId, setEditingLeadId] = useState<number | null>(null);
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    fetchLeads(true);
  }, [filterSource, filterStatus]);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loading) {
        fetchLeads();
      }
    });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [loaderRef.current, loading]);

  const fetchLeads = async (reset = false) => {
    setLoading(true);
    let query = supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (filterSource !== 'all') query = query.eq('source', filterSource);
    if (filterStatus !== 'all') query = query.eq('status', filterStatus);

    const from = reset ? 0 : page * LEADS_PER_PAGE;
    const to = from + LEADS_PER_PAGE - 1;
    const { data } = await query.range(from, to);

    setLeads(prev => reset ? (data || []) : [...prev, ...(data || [])]);
    setPage(prev => reset ? 1 : prev + 1);
    setLoading(false);
  };

  const toggleSelectLead = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const bulkUpdateStatus = async (status: string) => {
    if (selectedIds.length === 0) return;
    await supabase.from('leads').update({ status }).in('id', selectedIds);
    setSelectedIds([]);
    fetchLeads(true);
  };

  const sendLeadEmail = async (lead: any) => {
    const res = await fetch('/api/send-lead-email', {
      method: 'POST',
      body: JSON.stringify({
        to: 'your-team@example.com',
        subject: `New Lead: ${lead.phone || 'No phone'}`,
        text: `Lead Details:\n\n${JSON.stringify(lead, null, 2)}`
      }),
      headers: { 'Content-Type': 'application/json' }
    });
    alert(res.ok ? 'Email sent!' : 'Failed to send');
  };

  useEffect(() => {
    fetchLeads();
  }, [filterSource, filterStatus]);

  const markAsReviewed = async (id: number) => {
    await supabase.from('leads').update({ status: 'reviewed' }).eq('id', id);
    fetchLeads();
  };

  const updateLead = async () => {
    if (!editingLeadId || !editingLead) return;
    await supabase.from('leads').update(editingLead).eq('id', editingLeadId);
    setEditingLeadId(null);
    setEditingLead(null);
    fetchLeads();
  };

  const processFile = async (file: File) => {
    const preview = URL.createObjectURL(file);
    setReviewImage(preview);

    const photoPath = `leads/photos/${Date.now()}-${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage.from('leads').upload(photoPath, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      alert('Failed to upload photo');
      return;
    }

    const photoUrl = supabase.storage.from('leads').getPublicUrl(photoPath).data.publicUrl;

    const { leadData, confidence } = await createLeadFromPhoto(file);
    leadData.photo_url = photoUrl;

    if (confidence >= CONFIDENCE_THRESHOLD) {
      leadData.status = 'reviewed';
      await supabase.from('leads').insert([leadData]);
      fetchLeads();
    } else {
      setReviewLead({ ...leadData, confidence });
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFile(files[0]);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      await processFile(e.dataTransfer.files[0]);
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
  };

  const exportCsv = () => {
    const headers = ['phone', 'industry', 'city', 'state', 'source', 'status'];
    const csv = [headers.join(',')];
    for (const lead of leads) {
      const row = headers.map((h) => JSON.stringify(lead[h] ?? '')).join(',');
      csv.push(row);
    }
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads.csv';
    a.click();
  };

  const load = async () => {
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setLeads(data || []);
  };

  useEffect(() => { load(); }, []);

  const handleCSV = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const { data: domains } = await supabase.from('domains').select('*');
    const { data: campaigns } = await supabase.from('campaigns').select('*');
    const { data: existingLeads } = await supabase.from('leads').select('*');

    let duplicates = 0;
    let matchedDomains = 0;
    let matchedCampaigns = 0;

    Papa.parse<CSVLeadRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows: Lead[] = [];
    
        for (const row of results.data) {
          const tags = row.Tags || '';
          const parts = tags.split(',').map(s => s.trim());
    
          let city = row.City || '';
          let state = row.State || '';
          let industry = row.Industry || '';
        
          for (const part of parts) {
            const lower = part.toLowerCase();
            if (lower.includes('towing') || lower.includes('concrete')) {
              const words = part.split(' ');
              industry = words[0]?.toLowerCase() || '';
              city = words.slice(1).join(' ');
            }
          }
        
          if (parts.length >= 2) {
            state = parts[parts.length - 1];
            if (!city) city = parts[parts.length - 2];
          }
        
          const matchedDomain = domains?.find((d) =>
            d.domain?.toLowerCase().includes(city?.toLowerCase()) ||
            d.city?.toLowerCase() === city?.toLowerCase()
          ) || null;
          const matchedCampaign = campaigns?.find((c) =>
            c.city?.toLowerCase() === city?.toLowerCase() && c.status !== 'ended'
          ) || null;
        
          const isDuplicate = existingLeads?.some(l =>
            l.business_name === row.BusinessName?.trim() &&
            (l.phone === row.Phone?.trim() || l.address_city === city)
          );
        
          if (isDuplicate) {
            duplicates++;
            continue;
          }
        
          if (matchedDomain) matchedDomains++;
          if (matchedCampaign) matchedCampaigns++;
        
          const phoneMissing = !row.Phone;
          const rawName = row.BusinessName?.trim() || '';
          const cleanName = rawName.replace(/&amp;/g, '&');
          
          rows.push({
            id: crypto.randomUUID(),
            business_name: cleanName,
            contact_name: row.ContactName || '',
            phone: phoneMissing ? '' : (row.Phone?.trim() || ''),
            email: row.Email || '',
            notes: phoneMissing ? 'Needs contact info – phone missing' : `Imported on ${new Date().toISOString()}`,
            address_city: city,
            address_state: state,
            industry,
            domain_id: matchedDomain?.id || null,
            campaign_id: matchedCampaign?.id || null,
            outreach_status: phoneMissing ? 'research_needed' : 'not_contacted',
            date_created: new Date().toISOString(),
            created_at: new Date().toISOString(),
            owner_id: null
          });
        }

        const { error } = await supabase.from('leads').insert(rows);
        if (error) {
          console.error('❌ Insert error:', error);
          setError(`Upload failed: ${error.message}`);
          return;
        }

        setSummary({
          total: rows.length + duplicates,
          matchedDomains,
          matchedCampaigns,
          duplicates
        });
        setNextAction(true);
        load();
      }
    });
  };

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">Lead Tracker</h1>
      <button onClick={() => document.getElementById('manual-form')?.scrollIntoView({ behavior: 'smooth' })} className="mb-4 bg-blue-600 text-white px-4 py-1 rounded">
        + Create New Lead
      </button>

      <form id="manual-form" className="mb-4">
        <input type="file" accept=".csv" onChange={handleCSV} className="bg-white text-black px-2 py-1 rounded" />
      </form>

      <div className="text-xs text-gray-400 mb-2">
        Imported: {summary.total} total — ✅ Domains: {summary.matchedDomains} — 🎯 Campaigns: {summary.matchedCampaigns} — ❌ Duplicates: {summary.duplicates}
      </div>

      <div>
        <div className="mb-4 space-x-4">
          <button onClick={() => fileInputRef.current?.click()}>
            📸 Upload Lead Photo
          </button>
          <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
            <option value="all">All Sources</option>
            <option value="photo">Photo Only</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="reviewed">Reviewed</option>
            <option value="needs_review">Needs Review</option>
          </select>
          <button onClick={exportCsv} className="ml-2 px-2 py-1 text-sm bg-gray-200 rounded">⬇️ Export CSV</button>
        </div>

        <input
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          ref={fileInputRef}
          onChange={handlePhotoUpload}
        />

        <div
          ref={dropRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed p-6 text-center text-gray-500 rounded mb-4"
        >
          Drag & drop image here
        </div>

        {reviewLead && (
          <div className="p-4 border rounded bg-white shadow">
            <h3 className="text-lg font-bold mb-2">📝 Review Lead Before Saving</h3>
            {reviewImage && <img src={reviewImage} alt="Preview" className="max-w-xs mb-2" />}
            <label className="block mb-2">
              <span>📞 Phone</span>
              <input value={reviewLead.phone || ''} onChange={(e) => setReviewLead({ ...reviewLead, phone: e.target.value })} className="border p-1 w-full" />
            </label>
            <label className="block mb-2">
              <span>🏷 Industry</span>
              <input value={reviewLead.industry || ''} onChange={(e) => setReviewLead({ ...reviewLead, industry: e.target.value })} className="border p-1 w-full" />
            </label>
            <label className="block mb-2">
              <span>📍 City</span>
              <input value={reviewLead.city || ''} onChange={(e) => setReviewLead({ ...reviewLead, city: e.target.value })} className="border p-1 w-full" />
            </label>
            <label className="block mb-2">
              <span>🌎 State</span>
              <input value={reviewLead.state || ''} onChange={(e) => setReviewLead({ ...reviewLead, state: e.target.value })} className="border p-1 w-full" />
            </label>
            <p><strong>Confidence:</strong> {Math.round(reviewLead.confidence * 100)}%</p>
            <button onClick={saveReviewedLead} className="mt-2 px-4 py-2 bg-green-600 text-white rounded">Save Lead</button>
          </div>
        )}

        {editingLeadId && editingLead && (
          <div className="p-4 border rounded bg-white shadow mt-4">
            <h3 className="text-lg font-bold mb-2">✏️ Edit Lead</h3>
            <label className="block mb-2">
              <span>📞 Phone</span>
              <input value={editingLead.phone || ''} onChange={(e) => setEditingLead({ ...editingLead, phone: e.target.value })} className="border p-1 w-full" />
            </label>
            <label className="block mb-2">
              <span>🏷 Industry</span>
              <input value={editingLead.industry || ''} onChange={(e) => setEditingLead({ ...editingLead, industry: e.target.value })} className="border p-1 w-full" />
            </label>
            <label className="block mb-2">
              <span>📍 City</span>
              <input value={editingLead.city || ''} onChange={(e) => setEditingLead({ ...editingLead, city: e.target.value })} className="border p-1 w-full" />
            </label>
            <label className="block mb-2">
              <span>🌎 State</span>
              <input value={editingLead.state || ''} onChange={(e) => setEditingLead({ ...editingLead, state: e.target.value })} className="border p-1 w-full" />
            </label>
            <button onClick={updateLead} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded">Save Changes</button>
          </div>
        )}

        <div className="mt-8">
          <h2 className="text-lg font-bold mb-2">Leads</h2>
          <ul>
            {leads.map((lead) => (
              <li key={lead.id} className={`border-b py-2 ${!lead.phone ? 'bg-red-50' : ''}`}>
                <input type="checkbox" checked={selectedIds.includes(lead.id)} onChange={() => toggleSelectLead(lead.id)} className="mr-2" />
                <div><strong>{lead.phone || '❌ Missing Phone'}</strong> ({lead.industry || 'unknown'})</div>
                <div>{lead.city}, {lead.state}</div>
                <div>{lead.source}</div>
                <div>Status: {lead.status}</div>
                <button onClick={() => sendLeadEmail(lead)} className="text-sm text-green-700 underline mr-2">📤 Send</button>
                {lead.status === 'needs_review' && (
                  <button onClick={() => markAsReviewed(lead.id)} className="text-sm text-blue-600 underline">Mark as Reviewed</button>
                )}
                <button onClick={() => { setEditingLeadId(lead.id); setEditingLead(lead); }} className="text-sm text-indigo-600 underline ml-2">Edit</button>
                {lead.photo_url && <img src={lead.photo_url} alt="Lead" className="max-w-xs mt-2" />}
              </li>
            ))}
          </ul>

          <div ref={loaderRef} className="text-center py-4 text-gray-400">{loading && 'Loading more leads...'}</div>
          <div className="mt-4 space-x-2">
            <button onClick={() => bulkUpdateStatus('reviewed')} className="bg-green-100 px-2 py-1 text-sm rounded">Mark Reviewed</button>
            <button onClick={() => bulkUpdateStatus('archived')} className="bg-yellow-100 px-2 py-1 text-sm rounded">Archive</button>
          </div>
        </div>
      </div>
      {nextAction && (
        <div className="bg-gray-900 p-4 border border-gray-700 rounded mb-4 text-sm">
          <h2 className="font-bold text-lg mb-2">What's next?</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><a href="/start-campaign" className="text-blue-400 underline">Start a new Campaign</a></li>
            <li><a href="/print" className="text-blue-400 underline">Print Postcards</a></li>
            <li><a href="/leads" className="text-blue-400 underline">View Leads Needing Research</a></li>
          </ul>
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <table className="w-full text-sm text-left text-gray-300 bg-gray-800 rounded overflow-hidden">
        <thead className="bg-gray-700 text-gray-100 uppercase text-xs tracking-wide">
          <tr>
            <th className="px-4 py-2">Industry</th>
            <th className="px-4 py-2">City</th>
            <th className="px-4 py-2">State</th>
            <th className="px-4 py-2">Business</th>
            <th className="px-4 py-2">Phone</th>
            <th className="px-4 py-2">Domain</th>
            <th className="px-4 py-2">Campaign</th>
            <th className="px-4 py-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l, i) => (
            <tr key={l.id} className={i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900'}>
              <td className="px-4 py-2">{l.industry || '—'}</td>
              <td className="px-4 py-2">{l.address_city || '—'}</td>
              <td className="px-4 py-2">{l.address_state || '—'}</td>
              <td className="px-4 py-2">{l.business_name}</td>
              <td className="px-4 py-2">{l.phone}</td>
              <td className="px-4 py-2">{l.domain_id || '—'}</td>
              <td className="px-4 py-2">{l.campaign_id || '—'}</td>
              <td className="px-4 py-2">{l.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
