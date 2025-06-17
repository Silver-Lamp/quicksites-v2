// pages/admin/access-requests.tsx
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Head from 'next/head';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function AccessRequestDashboard() {
  const { role } = useCurrentUser();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('access_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRequests(data || []);
        setLoading(false);
      });
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const target = requests.find((r) => r.id === id);
    await fetch('/api/slack/notify-access-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: target?.email,
        status,
        org: target?.org,
        role: target?.role,
        message: target?.message,
        id: target?.id,
      }),
    });
    await supabase.from('access_requests').update({ status }).eq('id', id);
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
  };

  if (role !== 'admin' && role !== 'owner') {
    return (
      <div className="p-6 text-red-600">
        You are not authorized to view this page.
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Access Requests</title>
      </Head>
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-bold mb-4">🔐 Access Requests</h1>
        {loading && <p className="text-gray-400">Loading...</p>}
        {!loading && requests.length === 0 && <p>No requests yet.</p>}
        <ul className="space-y-4">
          {requests.map((r) => (
            <li key={r.id} className="bg-white rounded shadow p-4">
              <p>
                <strong>Email:</strong> {r.email}
              </p>
              <p>
                <strong>Org:</strong> {r.org || '—'}
              </p>
              <p>
                <strong>Role:</strong> {r.role || '—'}
              </p>
              <p>
                <strong>Status:</strong>{' '}
                <span className="font-semibold">{r.status}</span>
              </p>
              <p className="text-sm text-gray-500 whitespace-pre-wrap mt-2">
                {r.message}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => updateStatus(r.id, 'approved')}
                  className="text-sm bg-green-600 text-white px-3 py-1 rounded"
                >
                  Approve
                </button>
                <button
                  onClick={() => updateStatus(r.id, 'rejected')}
                  className="text-sm bg-red-600 text-white px-3 py-1 rounded"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
