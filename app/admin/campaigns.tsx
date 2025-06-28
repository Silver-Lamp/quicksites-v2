'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';
import dayjs from 'dayjs';
import AdminLayout from '@/components/layout/admin-layout';

type Campaign = {
  id: string;
  name: string;
  city: string;
  starts_at: string;
  ends_at: string;
};

type Lead = {
  id: string;
  campaign_id: string;
  business_name: string;
  email?: string;
  phone?: string;
  users?: {
    email?: string;
  };
  draft_sites?: {
    domain?: string;
    is_claimed?: boolean;
  };
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leadsByCampaign, setLeadsByCampaign] = useState<Record<string, Lead[]>>({});
  const [now, setNow] = useState(dayjs());
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    // Fetch user info
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data?.user?.email ?? null);
    });

    // Fetch campaigns
    supabase
      .from('campaigns')
      .select('*')
      .order('starts_at', { ascending: false })
      .then(({ data }) => setCampaigns(data || []));

    // Fetch leads
    supabase
      .from('leads')
      .select('*, draft_sites:domain_id(domain, is_claimed), users:owner_id(email)')
      .then(({ data }) => {
        const grouped: Record<string, Lead[]> = {};
        for (const lead of data || []) {
          if (lead.campaign_id) {
            if (!grouped[lead.campaign_id]) grouped[lead.campaign_id] = [];
            grouped[lead.campaign_id].push(lead);
          }
        }
        setLeadsByCampaign(grouped);
      });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(dayjs()), 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Campaigns</h1>
      {campaigns.map((c) => {
        const start = dayjs(c.starts_at);
        const end = dayjs(c.ends_at);
        const active = now.isAfter(start) && now.isBefore(end);
        const expired = now.isAfter(end);
        const duration = end.diff(start, 'minute');
        const remaining = end.diff(now, 'minute');
        const leads = leadsByCampaign[c.id] || [];

        const claimed = leads.find((l) => l.draft_sites?.is_claimed);
        const winner = claimed ? claimed.business_name : null;

        return (
          <div key={c.id} className="mb-6 bg-gray-800 p-4 rounded shadow">
            <h2 className="text-xl font-bold mb-2">
              {c.name} – {c.city}
            </h2>
            <p className="text-sm mb-1">
              {active ? '🟢 Active' : expired ? '🔴 Ended' : '🕓 Upcoming'} –
              {active
                ? ` ${remaining} min left`
                : expired
                ? 'Ended'
                : `Starts in ${start.diff(now, 'minute')} min`}
            </p>

            {active && (
              <div className="w-full h-2 bg-gray-700 rounded overflow-hidden mb-3">
                <div
                  className="bg-green-500 h-full transition-all"
                  style={{ width: `${(1 - remaining / duration) * 100}%` }}
                />
              </div>
            )}

            {leads.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 mt-4">
                {leads.map((l) => {
                  const isClaimed = l.draft_sites?.is_claimed;
                  const isOwned = userEmail && l.users?.email === userEmail;
                  const borderColor = isClaimed
                    ? 'border-green-500'
                    : isOwned
                    ? 'border-yellow-400'
                    : 'border-gray-600';
                  const label = isClaimed
                    ? '🏁 Claimed'
                    : isOwned
                    ? '🔒 Yours'
                    : 'Unclaimed';
                  const labelColor = isClaimed
                    ? 'text-green-400'
                    : isOwned
                    ? 'text-yellow-300'
                    : 'text-gray-400';

                  return (
                    <div key={l.id} className={`border p-3 rounded ${borderColor}`}>
                      <h3 className="font-semibold text-lg">{l.business_name}</h3>
                      <p className="text-xs">{l.email || 'No email'}</p>
                      <p className="text-xs">{l.phone || 'No phone'}</p>
                      <p className="text-xs">Owner: {l.users?.email || '—'}</p>
                      <p className={`text-xs mt-2 ${labelColor}`}>{label}</p>
                    </div>
                  );
                })}
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

CampaignsPage.getLayout = function getLayout(page: React.ReactNode) {
  return <AdminLayout>{page}</AdminLayout>;
};
