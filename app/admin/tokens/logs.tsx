'use client';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

export default function TokenLogsDashboard() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [logs, setLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    supabase
      .from('token_logs')
      .select('*')
      .order('downloaded_at', { ascending: false })
      .then(({ data }) => {
        setLogs(data || []);
      });
  }, [supabase]);

  const tokenCounts = logs.reduce((acc: any, log: any) => {
    acc[log.token_hash] = (acc[log.token_hash] || 0) + 1;
    return acc;
  }, {});

  const isSuspicious = (hash: string) => tokenCounts[hash] > 5;

  const filtered = logs.filter(
    (log) =>
      log.file_name.toLowerCase().includes(filter.toLowerCase()) ||
      log.token_hash.toLowerCase().includes(filter.toLowerCase())
  );

  const dateCounts = filtered.reduce((acc: any, log: any) => {
    const day = log.downloaded_at?.slice(0, 10);
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});

  const chartData = {
    labels: Object.keys(dateCounts),
    datasets: [
      {
        label: 'Downloads',
        data: Object.values(dateCounts),
        backgroundColor: 'var(--color-accent)',
      },
    ],
  };

  const exportCSV = () => {
    const rows = filtered.map((log) => ({
      file: log.file_name,
      time: log.downloaded_at,
      token: log.token_hash,
      user_agent: log.user_agent,
      suspicious: isSuspicious(log.token_hash),
    }));
    const csv = ['file,time,token,user_agent,suspicious']
      .concat(rows.map((r) => `${r.file},${r.time},${r.token},"${r.user_agent}",${r.suspicious}`))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'token_logs.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 text-text">
      <h1 className="text-2xl font-bold mb-4">📊 Token Download Logs</h1>

      <input
        type="text"
        placeholder="Filter by file or token hash"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full max-w-md mb-2 px-3 py-2 rounded bg-zinc-900 border border-zinc-700 text-sm"
      />

      <button
        onClick={exportCSV}
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Download CSV
      </button>

      <div className="bg-black p-4 rounded shadow mb-6">
        <Bar data={chartData} options={{ responsive: true }} />
      </div>

      <table className="w-full text-sm text-left bg-zinc-900 text-zinc-300 rounded overflow-hidden">
        <thead className="bg-zinc-700 text-xs uppercase text-zinc-100">
          <tr>
            <th className="p-2">File</th>
            <th className="p-2">Time</th>
            <th className="p-2">Token Hash</th>
            <th className="p-2">User Agent</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((log, i) => (
            <tr key={i} className="border-b border-zinc-800">
              <td className="p-2">{log.file_name}</td>
              <td className="p-2">{new Date(log.downloaded_at).toLocaleString()}</td>
              <td className="p-2 text-xs truncate">
                {isSuspicious(log.token_hash) && <span className="text-yellow-400">⚠️ </span>}
                {log.token_hash}
              </td>
              <td className="p-2 text-xs truncate">{log.user_agent}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
