  // pages/admin/embed-views.tsx
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Head from 'next/head';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function getFlagEmoji(countryCode: string) {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export default function EmbedViewsDashboard() {
  const [views, setViews] = useState<any[]>([]);
  const [locationTotals, setLocationTotals] = useState<Record<string, number>>({});
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const recentCounts = views.reduce(
      (acc, v) => {
        const now = new Date();
        const ts = new Date(v.created_at);
        const deltaHours = (now.getTime() - ts.getTime()) / 36e5;
        if (deltaHours <= 24) {
          acc[v.schema_id] = (acc[v.schema_id] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>
    );
    for (const [schema_id, count] of Object.entries(recentCounts)) {
      if ((count as number) >= 100) {
        fetch('/api/slack/embed-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schema_id, count }),
        });
      }
    }
    supabase
      .from('embed_views')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setViews(data || []);
        const locs: Record<string, number> = {};
        (data || []).forEach((v) => {
          const loc = v.location || 'Unknown';
          locs[loc] = (locs[loc] || 0) + 1;
        });
        setLocationTotals(locs);
        setLoading(false);
      });
  }, []);

  return (
    <>
      <Head>
        <title>Embed View Logs</title>
      </Head>
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex gap-4 mb-4">
          <label className="text-sm text-gray-500">Date Range:</label>
          <input
            type="date"
            className="border px-2 py-1 rounded text-sm"
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            className="border px-2 py-1 rounded text-sm"
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <input
            type="text"
            placeholder="Filter by schema ID, referrer, or date..."
            onChange={(e) => {
              const val = e.target.value.toLowerCase();
              setViews((prev) =>
                prev.filter(
                  (v) =>
                    v.schema_id.toLowerCase().includes(val) ||
                    (v.referrer || '').toLowerCase().includes(val) ||
                    new Date(v.created_at).toLocaleString().toLowerCase().includes(val)
                )
              );
            }}
            className="border text-sm px-2 py-1 rounded w-full md:max-w-xs"
          />
          <button
            onClick={() => {
              const csv = [
                ['schema_id', 'referrer', 'created_at'],
                ...views.map((v) => [v.schema_id, v.referrer || '', v.created_at]),
              ]
                .map((r) => r.join(','))
                .join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'embed-views.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="bg-blue-700 text-white text-sm px-4 py-1 rounded"
          >
            Export CSV
          </button>
        </div>
        <h1 className="text-xl font-bold mb-4">📊 Embed View Logs</h1>
        <div className="w-full h-64 mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={views.reduce(
                (acc, v) => {
                  const day = new Date(v.created_at).toISOString().slice(0, 10);
                  const ref = v.referrer || 'Other';
                  const key = `${day}|${ref}`;
                  const existing = acc.find((d: { key: string }) => d.key === key);
                  if (existing) existing.count++;
                  else acc.push({ date: day, referrer: ref, count: 1, key });
                  return acc;
                },
                [] as {
                  date: string;
                  referrer: string;
                  count: number;
                  key: string;
                }[]
              )}
            >
              <XAxis dataKey="date" interval="preserveStartEnd" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              {[...new Set(views.map((v) => v.referrer || 'Other'))].map((ref, i) => (
                <Bar
                  key={ref}
                  dataKey={(entry) => (entry.referrer === ref ? entry.count : 0)}
                  name={ref}
                  stackId="a"
                  fill={`hsl(${(i * 70) % 360}, 60%, 60%)`}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mb-4">
          <label className="text-sm text-gray-600">Filter by country:</label>
          <select
            onChange={(e) => {
              const c = e.target.value;
              if (c === '') return;
              setViews((prev) => prev.filter((v) => v.country_code === c));
            }}
            className="border px-2 py-1 text-sm rounded w-full md:max-w-sm"
          >
            <option value="">-- All Countries --</option>
            {[...new Set(views.map((v) => v.country_code).filter(Boolean))].map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label className="text-sm text-gray-600">Filter by schema ID:</label>
          <select
            onChange={(e) => {
              const id = e.target.value;
              if (id === '') return;
              setViews((prev) => prev.filter((v) => v.schema_id === id));
            }}
            className="border px-2 py-1 text-sm rounded w-full md:max-w-sm"
          >
            <option value="">-- All Schemas --</option>
            {[...new Set(views.map((v) => v.schema_id))].map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
        <input
          type="text"
          placeholder="Filter by schema ID, referrer, or date..."
          onChange={(e) => {
            const val = e.target.value.toLowerCase();
            setViews((prev) =>
              prev.filter(
                (v) =>
                  v.schema_id.toLowerCase().includes(val) ||
                  (v.referrer || '').toLowerCase().includes(val) ||
                  new Date(v.created_at).toLocaleString().toLowerCase().includes(val)
              )
            );
          }}
          className="border text-sm px-2 py-1 rounded w-full mb-4"
        />
        {loading && <p className="text-gray-400">Loading...</p>}
        {!loading && views.length === 0 && <p>No embed views recorded.</p>}
        <table className="w-full text-sm border mt-4">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-2">Schema ID</th>
              <th className="p-2">Country</th>
              <th className="p-2">Region</th>
              <th className="p-2">Schema ID</th>
              <th className="p-2">Referrer</th>
              <th className="p-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {views
              .filter((v) => {
                const created = new Date(v.created_at);
                const start = startDate ? new Date(startDate) : null;
                const end = endDate ? new Date(endDate + 'T23:59:59') : null;
                return (!start || created >= start) && (!end || created <= end);
              })
              .map((v) => (
                <tr key={v.id} className="border-t">
                  <td className="p-2 text-blue-600">
                    <a
                      href={`/admin/zod-playground?schema_id=${v.schema_id}`}
                      className="underline"
                    >
                      {v.schema_id}
                    </a>
                  </td>
                  <td className="p-2 text-gray-600">{v.country_code || '—'}</td>
                  <td className="p-2 text-gray-600">{v.region || '—'}</td>
                  <td className="p-2 text-gray-600">{v.referrer || '—'}</td>
                  <td className="p-2 text-gray-500">{new Date(v.created_at).toLocaleString()}</td>
                </tr>
              ))}
          </tbody>
        </table>

        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-2">🌍 Views by Location</h2>
          <ul className="text-sm text-gray-600 list-disc pl-5">
            {Object.entries(locationTotals).map(([loc, count]) => (
              <li key={loc}>
                {loc}: {count}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-2">🌐 Views by Country</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-sm text-gray-600">
            {Object.entries(locationTotals).map(([loc, count]) => (
              <div key={loc} className="flex items-center gap-2">
                <span className="text-xl">{getFlagEmoji(loc)}</span>
                <span>
                  {loc}: {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            const csv = [
              ['schema_id', 'referrer', 'created_at'],
              ...views.map((v) => [v.schema_id, v.referrer || '', v.created_at]),
            ]
              .map((r) => r.join(','))
              .join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'embed-views.csv';
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="mt-6 bg-blue-700 text-white px-4 py-1 rounded"
        >
          Export CSV
        </button>
      </div>
    </>
  );
}
