'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function PeopleAnalyticsPage() {
  const [data, setData] = useState([]);
  const [range, setRange] = useState(7);
  const [showIP, setShowIP] = useState(false);
  const [showAgent, setShowAgent] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: raw } = await supabase
        .from('user_profiles')
        .select('user_id, last_seen_at, last_seen_ip, last_seen_agent')
        .not('last_seen_at', 'is', null);

      const grouped: Record<
        string,
        { count: number; ips: Set<string>; agents: Set<string> }
      > = {};

      raw?.forEach((entry: any) => {
        const day = new Date(entry.last_seen_at).toISOString().split('T')[0];
        if (!grouped[day])
          grouped[day] = { count: 0, ips: new Set(), agents: new Set() };
        grouped[day].count += 1;
        if (entry.last_seen_ip) grouped[day].ips.add(entry.last_seen_ip);
        if (entry.last_seen_agent)
          grouped[day].agents.add(entry.last_seen_agent);
      });

      const chartData = Object.entries(grouped)
        .map(([date, obj]) => ({
          date,
          count: obj.count,
          ipCount: obj.ips.size,
          agentCount: obj.agents.size,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setData(chartData as any);
    })();
  }, []);

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - range);
  const filtered = data.filter((d: any) => {
    const day = new Date(d.date);
    return day >= start && day <= end;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold mb-4">User Activity Overview</h1>
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <label>
          Days:
          <select
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
            className="ml-2"
          >
            <option value={7}>Last 7</option>
            <option value={14}>Last 14</option>
            <option value={30}>Last 30</option>
            <option value={90}>Last 90</option>
          </select>
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={showIP}
            onChange={() => setShowIP((v) => !v)}
          />
          Show IPs
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={showAgent}
            onChange={() => setShowAgent((v) => !v)}
          />
          Show Devices
        </label>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={filtered}>
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#3b82f6" />
          {showIP && <Bar dataKey="ipCount" fill="#10b981" />}
          {showAgent && <Bar dataKey="agentCount" fill="#f59e0b" />}
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-2">Activity Summary</h2>
        <table className="min-w-full text-sm border">
          <thead>
            <tr className="border-b bg-gray-100 text-left">
              <th className="p-2">Date</th>
              <th className="p-2">Users</th>
              {showIP && <th className="p-2">Unique IPs</th>}
              {showAgent && <th className="p-2">Devices</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry: any) => (
              <tr key={entry.date} className="border-b">
                <td className="p-2">{entry.date}</td>
                <td className="p-2">{entry.count}</td>
                {showIP && <td className="p-2">{entry.ipCount}</td>}
                {showAgent && <td className="p-2">{entry.agentCount}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
