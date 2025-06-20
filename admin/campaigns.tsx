'use client';
import { useEffect, useState } from 'react';
import { useFlashToast } from '../hooks/useFlashToast.js';
import { useQueryFlash } from '../hooks/useQueryFlash.js';
import { supabase } from './lib/supabaseClient.js';

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFlashToast('new', { prefix: '✅ Campaign created: ' });
  const newCampaignId = useQueryFlash('new');

  useEffect(() => {
    const fetchCampaigns = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error) setCampaigns(data || []);
      setLoading(false);
    };

    fetchCampaigns();
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto text-white">
      <h1 className="text-2xl font-bold mb-6">📊 Campaigns</h1>
      {loading ? (
        <p className="text-sm text-zinc-400">Loading campaigns...</p>
      ) : campaigns.length === 0 ? (
        <p className="text-sm text-zinc-500">No campaigns found.</p>
      ) : (
        <table className="w-full text-sm border border-zinc-700">
          <thead className="bg-zinc-800">
            <tr>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">City</th>
              <th className="text-left px-3 py-2">State</th>
              <th className="text-left px-3 py-2">Leads</th>
              <th className="text-left px-3 py-2">Starts</th>
              <th className="text-left px-3 py-2">Ends</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr
                key={c.id}
                className={newCampaignId === c.id ? 'bg-green-900' : 'border-t border-zinc-700'}
              >
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2">{c.city}</td>
                <td className="px-3 py-2">{c.state}</td>
                <td className="px-3 py-2">{(c.lead_ids || []).join(', ')}</td>
                <td className="px-3 py-2">{c.starts_at?.slice(0, 10)}</td>
                <td className="px-3 py-2">{c.ends_at?.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
