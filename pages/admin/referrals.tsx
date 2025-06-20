import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient.js';

export default function ReferralsPage() {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.admin.listUsers().then(({ data }) => {
      setUsers(data?.users || []);
    });
  }, []);

  const referrers = users.filter((u) => u.user_metadata?.role === 'affiliate_referrer');
  const referredMap = Object.fromEntries(
    users.map((u) => [u.id, u.user_metadata?.referrer_id || null])
  );

  const downstreamCount = (refId: string) =>
    users.filter((u) => u.user_metadata?.referrer_id === refId).length;

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">Referral Dashboard</h1>
      <table className="w-full text-sm text-left text-gray-300 bg-gray-800 rounded overflow-hidden">
        <thead className="bg-gray-700 text-gray-100 uppercase text-xs tracking-wide">
          <tr>
            <th className="px-4 py-2">Referrer</th>
            <th className="px-4 py-2">Resellers Referred</th>
            <th className="px-4 py-2">Est. Sites Claimed</th>
            <th className="px-4 py-2">Est. Earnings</th>
          </tr>
        </thead>
        <tbody>
          {referrers.map((r, i) => {
            const resellers = users.filter((u) => u.user_metadata?.referrer_id === r.id);
            const estimatedSites = resellers.length * 10;
            const estimatedEarnings = estimatedSites * 49 * 0.1;

            return (
              <tr key={r.id} className={i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900'}>
                <td className="px-4 py-2">{r.email}</td>
                <td className="px-4 py-2">{resellers.length}</td>
                <td className="px-4 py-2">{estimatedSites}</td>
                <td className="px-4 py-2">${estimatedEarnings.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
