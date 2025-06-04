import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Papa from 'papaparse';
import type { CSVLeadRow, Lead } from '../types/lead.types';

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [summary, setSummary] = useState({ total: 0, matchedDomains: 0, matchedCampaigns: 0, duplicates: 0 });
  const [nextAction, setNextAction] = useState(false);
  const [error, setError] = useState('');

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
