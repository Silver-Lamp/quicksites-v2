// pages/admin/logs.tsx
'use client';

import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/admin/hooks/useCurrentUser';
import { createClient } from '@supabase/supabase-js';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminLogsPage() {
  const { user } = useCurrentUser();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const isAdmin = user?.user_metadata?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    const fetchLogs = async () => {
      let query = supabase.from('site_events').select('*').order('created_at', { ascending: false });
      if (filterType) query = query.eq('type', filterType);
      if (filterUser) query = query.ilike('payload->>user_email', `%${filterUser}%`);
      if (startDate) query = query.gte('created_at', startDate);
      if (endDate) query = query.lte('created_at', endDate + 'T23:59:59Z');
      const { data, error } = await query;
      if (error) console.error(error);
      else setLogs(data || []);
      setLoading(false);
    };
    fetchLogs();
  }, [filterType, filterUser, startDate, endDate, isAdmin]);

  const exportCSV = () => {
    const rows = logs.map((log) => ({
      created_at: log.created_at,
      type: log.type,
      user_email: log.payload?.user_email || '',
      payload: JSON.stringify(log.payload),
    }));
    const csv =
      'created_at,type,user_email,payload\n' +
      rows.map((r) => `${r.created_at},${r.type},${r.user_email},"${r.payload.replace(/"/g, '""')}"`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'logs.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPayload = (payload: any, id: string) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payload-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chartData = (() => {
    const counts: Record<string, number> = {};
    logs.forEach((log) => {
      const date = new Date(log.created_at).toISOString().split('T')[0];
      counts[date] = (counts[date] || 0) + 1;
    });
    const labels = Object.keys(counts).sort();
    return {
      labels,
      datasets: [
        {
          label: 'Logs per Day',
          data: labels.map((label) => counts[label]),
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
        },
      ],
    };
  })();

  if (!user?.id) return <p className="p-6 text-center">🔒 You must be signed in to view logs.</p>;
  if (!isAdmin) return <p className="p-6 text-center text-red-600">⛔ Access denied. Admins only.</p>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">📜 Deployment Logs</h1>
        <button onClick={exportCSV} className="bg-gray-800 text-white px-4 py-2 rounded text-sm">
          Export CSV
        </button>
      </div>

      <div className="flex gap-4">
        <button onClick={exportWeeklySummaryCSV} className="text-sm text-green-700 underline">Export CSV</button>
        <button onClick={() => exportChartImage('weekly-summary-canvas', 'weekly-summary.png')} className="text-sm text-blue-600 underline">
            Export Chart as Image
        </button>
        <button onClick={() => alert('🛠 PDF + email export coming soon')} className="text-sm text-purple-700 underline">
            Generate PDF / Email
        </button>
      </div>
      <Bar
        id="weekly-summary-canvas"
        data={weeklyChartData}
        options={{ responsive: true, plugins: { legend: { position: 'top' } } }}
        />
        {/* // ✅ Let me know when you're ready to wire up PDF generation or email via Supabase functions / SendGrid! */}

      <div className="flex flex-wrap gap-4 items-center">
        <label className="font-semibold">Type:</label>
        <input value={filterType} onChange={(e) => setFilterType(e.target.value)} placeholder="e.g. deploy_site" className="border px-3 py-1 rounded" />
        <label className="font-semibold">User Email:</label>
        <input value={filterUser} onChange={(e) => setFilterUser(e.target.value)} placeholder="email@example.com" className="border px-3 py-1 rounded" />
        <label className="font-semibold">Start Date:</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border px-3 py-1 rounded" />
        <label className="font-semibold">End Date:</label>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border px-3 py-1 rounded" />
        <button onClick={() => { setFilterType(''); setFilterUser(''); setStartDate(''); setEndDate(''); }} className="text-sm text-blue-600 underline">Clear Filters</button>
      </div>

      <div className="bg-white p-4 border rounded shadow">
        <h2 className="text-lg font-semibold mb-2">📊 Logs Per Day</h2>
        <Bar data={chartData} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />
      </div>

      {loading && <p>Loading...</p>}
      {!loading && logs.length === 0 && <p>No logs found.</p>}
      <div className="space-y-4">
        {logs.map((log) => (
          <div key={log.id} className="bg-white p-4 border rounded shadow text-sm">
            <p className="text-gray-500">🕒 {new Date(log.created_at).toLocaleString()}</p>
            <p className="font-semibold text-blue-700">{log.type}</p>
            <p className="text-xs text-gray-600">👤 {log.payload?.user_email || 'N/A'}</p>
            <pre className="overflow-auto max-h-64 bg-gray-100 mt-2 p-2 rounded">{JSON.stringify(log.payload, null, 2)}</pre>
            <button onClick={() => downloadPayload(log.payload, log.id)} className="mt-2 text-xs text-blue-600 underline">Download Payload JSON</button>
          </div>
        ))}
      </div>
    </div>
  );
}
// ✅ Weekly summary chart now exportable to image + PDF + email-ready

import html2pdf from 'html2pdf.js';

// 📷 Add exportChartImage utility
const exportChartImage = (canvasId: string, filename: string) => {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  if (!canvas) return;
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
};

// 📄 Export full weekly summary container as PDF
const exportWeeklySummaryPDF = () => {
  const element = document.getElementById('weekly-summary-container');
  if (!element) return;
  html2pdf()
    .set({ margin: 0.5, filename: 'weekly-summary.pdf', html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } })
    .from(element)
    .save();
};

// 📬 Email trigger placeholder
const emailWeeklySummary = async () => {
  const res = await fetch('https://<your-project>.functions.supabase.co/email-weekly-summary', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabase.auth.getSession()?.access_token}`,
    },
    body: JSON.stringify({ summary, userEmail }),
  });
  
  const json = await res.json();
  alert(json.message || 'Email request sent');
};

// 🧾 Add download and email buttons to JSX:
<>
  // 🧾 Add download and email buttons to JSX:
  <div className="flex gap-4">
    <button onClick={exportWeeklySummaryCSV} className="text-sm text-green-700 underline">Export CSV</button>
    <button onClick={() => exportChartImage('weekly-summary-canvas', 'weekly-summary.png')} className="text-sm text-blue-600 underline">
      Export Chart as Image
    </button>
    <button onClick={exportWeeklySummaryPDF} className="text-sm text-purple-700 underline">
      Download Weekly PDF
    </button>
    <button onClick={emailWeeklySummary} className="text-sm text-amber-700 underline">
      Email Summary
    </button>
  </div>
  // 🖼️ Add container and canvas id:
  <div id="weekly-summary-container" className="bg-white p-4 border rounded shadow space-y-4">
    <h2 className="text-lg font-semibold">📊 Log Breakdown</h2>
    <Bar id="weekly-summary-canvas" data={weeklyChartData} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />
    <h2 className="text-lg font-semibold">📈 Total Logs Over Time</h2>
    <Line data={lineChartData} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />
    <div className="flex justify-between items-center">
      <h2 className="text-lg font-semibold">📅 Weekly Summary</h2>
    </div>
    <ul className="list-disc list-inside text-sm text-gray-700">
      {weeklySummary.map(([week, count]) => (
        <li key={week}>{week}: {count} log{count !== 1 ? 's' : ''}</li>
      ))}
    </ul>
  </div></>

// ✅ Next: scaffold `/api/email-weekly-summary.ts` as Supabase Edge Function or Next.js API route to send the summary!
