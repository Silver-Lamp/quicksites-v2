import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/admin/lib/supabaseClient';

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const role = data?.user?.user_metadata?.role;
      if (role !== 'admin') {
        router.push('/login?error=unauthorized');
      }

      const { data: list, error } = await supabase.auth.admin.listUsers();
      if (error) setError(error.message);
      else setUsers(list.users || []);
    });
  }, []);

  const updateRole = async (userId: string, role: string) => {
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { role },
    });
    const refreshed = await supabase.auth.admin.listUsers();
    setUsers(refreshed.data?.users || []);
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
            <th className="px-4 py-2">Referred By</th>
            <th className="px-4 py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u, i) => (
            <tr key={u.id} className={i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900'}>
              <td className="px-4 py-2">{u.email}</td>
              <td className="px-4 py-2">
                <select
                  value={u.user_metadata?.role || 'viewer'}
                  onChange={(e) => updateRole(u.id, e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
                >
                  <option value="admin">admin</option>
                  <option value="reseller">reseller</option>
                  <option value="affiliate_referrer">affiliate_referrer</option>
                  <option value="viewer">viewer</option>
                </select>
              </td>
              <td className="px-4 py-2 text-xs">{u.user_metadata?.referrer_id || '—'}</td>
              <td className="px-4 py-2 text-xs">{new Date(u.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
