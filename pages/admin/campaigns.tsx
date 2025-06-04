import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [leadsByCampaign, setLeadsByCampaign] = useState<Record<string, any[]>>({});

  useEffect(() => {
    supabase
      .from('campaigns')
      .select('*')
      .order('starts_at', { ascending: false })
      .then(({ data }) => setCampaigns(data || []));

    supabase
      .from('leads')
      .select('*, domains(domain, is_claimed)')
      .then(({ data }) => {
        const grouped: Record<string, any[]> = {};
        for (const lead of data || []) {
          if (lead.campaign_id) {
            if (!grouped[lead.campaign_id]) grouped[lead.campaign_id] = [];
            grouped[lead.campaign_id].push(lead);
          }
        }
        setLeadsByCampaign(grouped);
      });
  }, []);

  const now = dayjs();

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">Campaigns</h1>
      {campaigns.map((c, i) => {
        const start = dayjs(c.starts_at);
        const end = dayjs(c.ends_at);
        const active = now.isAfter(start) && now.isBefore(end);
        const expired = now.isAfter(end);
        const remaining = end.diff(now, 'minute');
        const leads = leadsByCampaign[c.id] || [];

        const claimed = leads.find((l) => l.domains?.is_claimed);
        const winner = claimed ? claimed.business_name : null;

        return (
          <div key={c.id} className="mb-6 bg-gray-800 p-4 rounded shadow">
            <h2 className="text-xl font-bold mb-2">{c.name} – {c.city}</h2>
            <p className="text-sm mb-1">
              {active ? '🟢 Active' : expired ? '🔴 Ended' : '🕓 Upcoming'} –
              {active ? ` ${remaining} min left` : expired ? 'Ended' : `Starts in ${start.diff(now, 'minute')} min`}
            </p>
            {leads.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 mt-4">
                {leads.map((l) => (
                  <div key={l.id} className={`border p-3 rounded ${l.domains?.is_claimed ? 'border-green-500' : 'border-gray-600'}`}>
                    <h3 className="font-semibold text-lg">{l.business_name}</h3>
                    <p className="text-xs">{l.email || 'No email'}</p>
                    <p className="text-xs">{l.phone || 'No phone'}</p>
                    <p className={`text-xs mt-2 ${l.domains?.is_claimed ? 'text-green-400' : 'text-gray-400'}`}>
                      {l.domains?.is_claimed ? '🏁 Claimed' : 'Unclaimed'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 mt-2">No leads linked.</p>
            )}
            {winner && <p className="mt-3 text-green-400 font-bold">🎉 Winner: {winner}</p>}
          </div>
        );
      })}
    </div>
  );
}
