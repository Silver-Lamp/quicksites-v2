'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function PeopleChartPage() {
  const [data, setData] = useState([]);

  useEffect(() => {
    (async () => {
      const { data: raw } = await supabase
        .from('user_profiles')
        .select('user_id, last_seen_at')
        .not('last_seen_at', 'is', null);

      const counts: Record<string, number> = {};
      raw?.forEach((entry: any) => {
        const day = new Date(entry.last_seen_at).toISOString().split('T')[0];
        counts[day] = (counts[day] || 0) + 1;
      });

      const chartData = Object.entries(counts)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setData(chartData as any);
    })();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-4">User Activity by Day</h1>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
