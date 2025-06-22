// ✅ FIXED: pages/admin/logs.tsx

'use client';

import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { supabase } from '@/admin/lib/supabaseClient';
import html2pdf from 'html2pdf.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function AdminLogsPage() {
  const { user } = useCurrentUser();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    const fetchLogs = async () => {
      let query = supabase
        .from('site_events')
        .select('*')
        .order('created_at', { ascending: false });
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
      rows
        .map((r) => `${r.created_at},${r.type},${r.user_email},"${r.payload.replace(/"/g, '""')}"`)
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'logs.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPayload = (payload: any, id: string) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
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

  const exportChartImage = (canvasId: string, filename: string) => {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  const exportWeeklySummaryPDF = () => {
    const element = document.getElementById('weekly-summary-container');
    if (!element) return;
    html2pdf()
      .set({
        margin: 0.5,
        filename: 'weekly-summary.pdf',
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
      })
      .from(element)
      .save();
  };

  const emailWeeklySummary = async () => {
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    const userEmail = session.data.session?.user?.user_metadata?.email;

    const res = await fetch('https://<your-project>.functions.supabase.co/email-weekly-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ summary: chartData, userEmail }),
    });

    const result = await res.json();
    alert(result.message || 'Email request sent');
  };

  if (!user?.id) return <p className="p-6 text-center">🔒 You must be signed in to view logs.</p>;
  if (!isAdmin)
    return <p className="p-6 text-center text-red-600">⛔ Access denied. Admins only.</p>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">📜 Deployment Logs</h1>
        <button onClick={exportCSV} className="bg-gray-800 text-white px-4 py-2 rounded text-sm">
          Export CSV
        </button>
      </div>

      <div className="flex gap-4">
        <button onClick={exportCSV} className="text-sm text-green-700 underline">
          Export CSV
        </button>
        <button
          onClick={() => exportChartImage('weekly-summary-canvas', 'weekly-summary.png')}
          className="text-sm text-blue-600 underline"
        >
          Export Chart as Image
        </button>
        <button onClick={exportWeeklySummaryPDF} className="text-sm text-purple-700 underline">
          Download Weekly PDF
        </button>
        <button onClick={emailWeeklySummary} className="text-sm text-amber-700 underline">
          Email Summary
        </button>
      </div>

      <div id="weekly-summary-container" className="bg-white p-4 border rounded shadow space-y-4">
        <h2 className="text-lg font-semibold">📊 Log Breakdown</h2>
        <Bar
          id="weekly-summary-canvas"
          data={chartData}
          options={{
            responsive: true,
            plugins: { legend: { position: 'top' } },
          }}
        />
        <h2 className="text-lg font-semibold">📈 Total Logs Over Time</h2>
        <Line
          data={chartData}
          options={{
            responsive: true,
            plugins: { legend: { position: 'top' } },
          }}
        />
      </div>

      {loading && <p>Loading...</p>}
      {!loading && logs.length === 0 && <p>No logs found.</p>}
      <div className="space-y-4">
        {logs.map((log) => (
          <div key={log.id} className="bg-white p-4 border rounded shadow text-sm">
            <p className="text-gray-500">🕒 {new Date(log.created_at).toLocaleString()}</p>
            <p className="font-semibold text-blue-700">{log.type}</p>
            <p className="text-xs text-gray-600">👤 {log.payload?.user_email || 'N/A'}</p>
            <pre className="overflow-auto max-h-64 bg-gray-100 mt-2 p-2 rounded">
              {JSON.stringify(log.payload, null, 2)}
            </pre>
            <button
              onClick={() => downloadPayload(log.payload, log.id)}
              className="mt-2 text-xs text-blue-600 underline"
            >
              Download Payload JSON
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
