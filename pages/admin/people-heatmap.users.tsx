'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

function getDayKey(date) {
  return new Date(date).toISOString().split('T')[0];
}

function getDateArray(daysBack = 90) {
  const result = [];
  const today = new Date();
  for (let i = daysBack; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    result.push(getDayKey(d));
  }
  return result;
}

export default function MiniHeatmapsByUser() {
  const [users, setUsers] = useState([]);
  const days = getDateArray();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('user_id, avatar_url, last_seen_at')
        .not('last_seen_at', 'is', null);

      const userMap = {};
      data.forEach((entry) => {
        const id = entry.user_id;
        const day = getDayKey(entry.last_seen_at);
        if (!userMap[id]) {
          userMap[id] = { avatar_url: entry.avatar_url, days: new Set() };
        }
        userMap[id].days.add(day);
      });

      const formatted = Object.entries(userMap).map(([id, info]) => {
        const weekMap = {};
        Array.from(info.days).forEach((day) => {
          const week = day.slice(0, 7); // YYYY-MM
          weekMap[week] = (weekMap[week] || 0) + 1;
        });
        const avgPerWeek = (
          Object.values(weekMap).reduce((a, b) => a + b, 0) / Object.keys(weekMap).length
        ).toFixed(1);

        return {
          user_id: id,
          avatar_url: info.avatar_url,
          active_days: info.days,
          avg: avgPerWeek
        };
      });

      setUsers(formatted);
    })();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold mb-6">User Activity Heatmaps</h1>
      <p className="text-sm text-gray-500 mb-4">
        Past 90 days · Weekly average activity shown next to avatar
      </p>
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        {users.map((user) => (
          <div key={user.user_id} className="bg-white border rounded p-4 shadow">
            <div className="flex items-center gap-3 mb-3">
              <img
                src={user.avatar_url || '/default-avatar.png'}
                className="w-10 h-10 rounded-full border"
              />
              <span className="text-xs text-gray-500">Avg: {user.avg}/week</span>
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
                    borderRadius: '2px'
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
