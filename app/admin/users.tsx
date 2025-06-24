'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCanonicalRole } from '@/hooks/useCanonicalRole';
import { supabase } from '@/admin/lib/supabaseClient';

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const { role } = useCanonicalRole();

  useEffect(() => {
    if (role === null) return;

    if (role !== 'admin') {
      router.push('/login?error=unauthorized');
      return;
    }

    const loadUsersAndRoles = async () => {
      try {
        const { data: userList, error: userError } = await supabase.auth.admin.listUsers();
        if (userError) {
          setError(userError.message);
          return;
        }
        setUsers(userList.users || []);

        const { data: profileList } = await supabase.from('user_profiles').select('user_id, role');
        const profileMap: Record<string, string> = {};
        profileList?.forEach((p) => {
          profileMap[p.user_id] = p.role;
        });
        setProfiles(profileMap);
      } catch (err) {
        console.error('❌ Failed to load users or profiles', err);
        setError('Failed to load users');
      }
    };

    loadUsersAndRoles();
  }, [role]);

  const updateRole = async (userId: string, newRole: string) => {
    await supabase
      .from('user_profiles')
      .upsert({ user_id: userId, role: newRole }, { onConflict: 'user_id' });

    setProfiles((prev) => ({ ...prev, [userId]: newRole }));
  };

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">Users</h1>
      {error && <p className="text-red-500">{error}</p>}
      <table className="w-full text-sm text-left text-gray-300 bg-gray-800 rounded overflow-hidden">
        <thead className="bg-gray-700 text-gray-100 uppercase text-xs tracking-wide">
          <tr>
            <th className="px-4 py-2">Email</th>
            <th className="px-4 py-2">Role</th>
            <th className="px-4 py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u, i) => (
            <tr key={u.id} className={i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900'}>
              <td className="px-4 py-2">{u.email}</td>
              <td className="px-4 py-2">
                <select
                  value={profiles[u.id] || 'viewer'}
                  onChange={(e) => updateRole(u.id, e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
                >
                  <option value="admin">admin</option>
                  <option value="reseller">reseller</option>
                  <option value="affiliate_referrer">affiliate_referrer</option>
                  <option value="viewer">viewer</option>
                </select>
              </td>
              <td className="px-4 py-2 text-xs">{new Date(u.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
