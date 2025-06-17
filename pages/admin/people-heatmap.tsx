'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient.js';

type HeatmapEntry = {
  last_seen_at: string;
  last_seen_ip?: string;
};

type HeatmapBucket = {
  user: number;
  ips: Set<string>;
};

function getDayKey(date: string | Date): string {
  return new Date(date).toISOString().split('T')[0];
}

export default function CalendarHeatmap() {
  const [buckets, setBuckets] = useState<Record<string, HeatmapBucket>>({});

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('last_seen_at, last_seen_ip')
        .not('last_seen_at', 'is', null);

      if (error || !data) {
        console.error(error);
        return;
      }

      const grouped: Record<string, HeatmapBucket> = {};

      (data as HeatmapEntry[]).forEach((entry) => {
        const day = getDayKey(entry.last_seen_at);

        if (!grouped[day]) {
          grouped[day] = { user: 0, ips: new Set() };
        }

        grouped[day].user += 1;

        if (entry.last_seen_ip) {
          grouped[day].ips.add(entry.last_seen_ip);
        }
      });

      setBuckets(grouped);
    };

    load();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-4">📅 Calendar Heatmap</h1>
      <ul className="text-sm space-y-2">
        {Object.entries(buckets)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, { user, ips }]) => (
            <li key={day}>
              <strong>{day}</strong>: {user} user(s), {ips.size} unique IP(s)
            </li>
          ))}
      </ul>
    </div>
  );
}
