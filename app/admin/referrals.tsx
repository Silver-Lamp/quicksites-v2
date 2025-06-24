'use client';

import { useEffect, useState } from 'react';
import { useCanonicalRole } from '@/hooks/useCanonicalRole';
import { useRouter } from 'next/navigation';
import { supabase } from '@/admin/lib/supabaseClient';

const DEBUG = process.env.NEXT_PUBLIC_DEBUG_AUTH === 'true';

export default function ReferralsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [error, setError] = useState('');
  const { role } = useCanonicalRole();
  const router = useRouter();

  useEffect(() => {
    if (role === null) return;

    if (role !== 'admin') {
      router.push('/login?error=unauthorized');
      return;
    }

    const fetchData = async () => {
      DEBUG && console.log('[👥 Fetching Users + Profiles]');

      const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
      if (userError) {
        setError(userError.message);
        return;
      }
      setUsers(userData?.users || []);

      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('user_id, role, referrer_id');

      const profileMap: Record<string, any> = {};
      profileData?.forEach((p) => {
        profileMap[p.user_id] = { role: p.role, referrer_id: p.referrer_id };
      });
      setProfiles(profileMap);

      DEBUG && console.log('[✅ Profiles Loaded]', profileMap);
    };

    fetchData();
  }, [role]);

  const referrers = users.filter((u) => profiles[u.id]?.role === 'affiliate_referrer');

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">Referral Dashboard</h1>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
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
            const refId = r.id;
            const resellers = users.filter(
              (u) => profiles[u.id]?.referrer_id === refId && profiles[u.id]?.role === 'reseller'
            );
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
