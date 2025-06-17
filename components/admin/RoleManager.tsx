'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/hooks/useCurrentUser';

type RoleEntry = {
  user_email: string;
  role: string;
  updated_at: string;
};

const AVAILABLE_ROLES = ['admin', 'reseller', 'viewer'];

export default function RoleManager() {
  const { role } = useCurrentUser();
  const [roles, setRoles] = useState<RoleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (role !== 'admin') return;

    const fetchRoles = async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_email, role, updated_at')
        .order('updated_at', { ascending: false });
      if (!error) setRoles(data);
      setLoading(false);
    };

    fetchRoles();
  }, [role]);

  const handleChangeRole = async (email: string, newRole: string) => {
    const { error } = await supabase.from('user_roles').insert({
      user_email: email,
      role: newRole,
      source: 'manual',
    });

    if (!error) {
      setRoles((prev) => [
        {
          user_email: email,
          role: newRole,
          updated_at: new Date().toISOString(),
        },
        ...prev.filter((r) => r.user_email !== email),
      ]);
    }
  };

  if (role !== 'admin') return null;
  if (loading) return <p className="text-sm text-gray-400">Loading roles…</p>;

  return (
    <div className="bg-zinc-900 p-6 rounded-lg shadow max-w-2xl text-white">
      <h2 className="text-xl font-bold mb-4">User Roles</h2>
      <table className="w-full text-sm border border-zinc-800">
        <thead>
          <tr className="bg-zinc-800 text-left">
            <th className="p-2">Email</th>
            <th className="p-2">Role</th>
            <th className="p-2">Change To</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r, idx) => (
            <tr
              key={`${r.user_email}-${idx}`}
              className="border-t border-zinc-800"
            >
              <td className="p-2">{r.user_email}</td>
              <td className="p-2">{r.role}</td>
              <td className="p-2">
                <select
                  value={r.role}
                  onChange={(e) =>
                    handleChangeRole(r.user_email, e.target.value)
                  }
                  className="bg-zinc-800 text-white p-1 rounded"
                >
                  {AVAILABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
