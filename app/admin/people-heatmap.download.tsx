'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';

type UserEntry = {
  user_id: string;
  avatar_url: string | null;
  last_seen_at: string;
  role: string;
};

type UserMapEntry = {
  avatar_url: string | null;
  role: string;
  days: Set<string>;
};

type HeatmapUser = {
  user_id: string;
  avatar_url: string | null;
  role: string;
  active_days: Set<string>;
};

function getDayKey(date: string | Date): string {
  return new Date(date).toISOString().split('T')[0];
}

function getDateArray(daysBack = 90): string[] {
  const result: string[] = [];
  const today = new Date();
  for (let i = daysBack; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    result.push(getDayKey(d));
  }
  return result;
}

export default function UserHeatmapDownloadable() {
  const [users, setUsers] = useState<HeatmapUser[]>([]);
  const [role, setRole] = useState('');
  const [days] = useState<string[]>(getDateArray());

  useEffect(() => {
    (async () => {
      const { data: raw } = await supabase
        .from('user_profiles')
        .select('user_id, avatar_url, last_seen_at, role')
        .not('last_seen_at', 'is', null);

      const userMap: Record<string, UserMapEntry> = {};

      raw?.forEach((entry: UserEntry) => {
        const id = entry.user_id;
        const day = getDayKey(entry.last_seen_at);
        if (!userMap[id]) {
          userMap[id] = {
            avatar_url: entry.avatar_url,
            role: entry.role,
            days: new Set<string>(),
          };
        }
        userMap[id].days.add(day);
      });

      const formatted: HeatmapUser[] = Object.entries(userMap).map(([id, info]) => ({
        user_id: id,
        avatar_url: info.avatar_url,
        role: info.role,
        active_days: info.days,
      }));

      setUsers(formatted);
    })();
  }, []);

  const filteredUsers = role ? users.filter((u) => u.role === role) : users;

  const handleDownload = () => {
    const csv = [
      ['user_id', 'role', 'active_day_count', 'days'],
      ...filteredUsers.map((u) => [
        u.user_id,
        u.role,
        u.active_days.size,
        Array.from(u.active_days).join(';'),
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'user-activity.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">User Activity Overview</h1>
        <button
          className="text-sm bg-blue-600 text-white px-3 py-1 rounded"
          onClick={handleDownload}
        >
          Export CSV
        </button>
      </div>

      <div className="mb-4 flex gap-3 items-center">
        <label className="text-sm">Filter by Role:</label>
        <select className="text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
      </div>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        {filteredUsers.map((user) => (
          <div key={user.user_id} className="bg-white border rounded p-4 shadow">
            <div className="flex items-center gap-3 mb-3">
              <img
                src={user.avatar_url || '/default-avatar.png'}
                className="w-10 h-10 rounded-full border"
              />
              <span className="text-xs text-gray-500">{user.role || 'user'}</span>
            </div>
            <div className="grid grid-cols-27 gap-[2px] text-xs">
              {days.map((date) => (
                <div
                  key={date}
                  title={date}
                  style={{
                    width: '10px',
                    height: '10px',
                    backgroundColor: user.active_days.has(date) ? '#2563eb' : '#e5e7eb',
                    borderRadius: '2px',
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
