'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

function getDateArray(daysBack = 180) {
  const result = [];
  const today = new Date();
  for (let i = daysBack; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    result.push(d.toISOString().split('T')[0]);
  }
  return result;
}

export default function Heatmap({ daysBack = 180 }: { daysBack?: number }) {
  const [activity, setActivity] = useState({});
  const [mode, setMode] = useState<'user' | 'ip'>('user');
  const dates = getDateArray(daysBack);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('last_seen_at, last_seen_ip')
        .not('last_seen_at', 'is', null);

      const grouped: Record<string, { user: number; ips: Set<string> }> = {};
      data?.forEach((entry) => {
        const day = new Date(entry.last_seen_at).toISOString().split('T')[0];
        if (!grouped[day]) grouped[day] = { user: 0, ips: new Set() };
        grouped[day].user += 1;
        if (entry.last_seen_ip) grouped[day].ips.add(entry.last_seen_ip);
      });

      const finalized: Record<string, { user: number; ip: number }> = {};
      Object.entries(grouped).forEach(([date, stats]) => {
        finalized[date] = {
          user: stats.user,
          ip: stats.ips.size,
        };
      });

      setActivity(finalized);
    })();
  }, []);

  const color = (count: number) => {
    if (!count) return '#e5e7eb';
    if (count > 10) return '#2563eb';
    if (count > 5) return '#60a5fa';
    if (count > 2) return '#93c5fd';
    return '#dbeafe';
  };

  return (
    <div>
      <div className="mb-2 text-sm flex gap-4 items-center">
        <label>
          <input
            type="radio"
            name="mode"
            value="user"
            checked={mode === 'user'}
            onChange={() => setMode('user')}
          />{' '}
          User Count
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            value="ip"
            checked={mode === 'ip'}
            onChange={() => setMode('ip')}
          />{' '}
          Unique IPs
        </label>
      </div>
      <div className="flex space-x-2">
        <div className="flex flex-col space-y-1 mt-5">
          {['Sun', 'Tue', 'Thu', 'Sat'].map((day) => (
            <div key={day} className="text-xs text-gray-400">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-27 gap-1 text-xs">
          {dates.map((date) => {
            const count =
              (activity as Record<string, { user: number; ip: number }>)[
                date
              ]?.[mode] || 0;
            const title = `${date}: ${count} ${mode === 'ip' ? 'unique IPs' : 'user(s)'}`;
            return (
              <div
                key={date}
                title={title}
                style={{
                  width: '12px',
                  height: '12px',
                  backgroundColor: color(count),
                  borderRadius: '2px',
                  transition: 'background-color 0.2s',
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
