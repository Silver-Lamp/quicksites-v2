'use client';
import { useEffect, useState } from 'react';
import { AdminAnalyticsToolbar } from '@/components/admin/analytics/AdminAnalyticsToolbar';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import { useDateRange } from '@/hooks/useDateRange';

export default function AnalyticsChartView() {
  const [view, setView] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [stats, setStats] = useState([]);
  const [data, setData] = useState<any[]>([]);
  const { start, end } = useDateRange();
  const fetchData = async () => {
    const today = new Date();
    const from = new Date();
    from.setDate(today.getDate() - (view === 'weekly' ? 7 : view === 'monthly' ? 30 : 1));

    useEffect(() => {
      if (!start || !end) return;
      fetch(`/api/analytics/signals?start=${start}&end=${end}`)
        .then(res => res.json())
        .then(setData);
    }, [start, end]);
    
    const res = await fetch(
      \`/api/analytics/signals?start=\${from.toISOString().slice(0, 10)}&end=\${today.toISOString().slice(0, 10)}\`
    );
    const rows = await res.json();
    setData(rows);

    const totals = rows.reduce(
      (acc, row) => {
        acc.views += row.views;
        acc.feedback += row.feedback;
        return acc;
      },
      { views: 0, feedback: 0 }
    );
    setStats([
      { label: 'Views', value: totals.views },
      { label: 'Feedback', value: totals.feedback }
    ]);
  };

  const downloadCSV = () => {
    const rows = ['Date,Views,Feedback', ...data.map((r) => \`\${r.date},\${r.views},\${r.feedback}\`)];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'signals.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchData();
  }, [view]);

  return (
    <div className="p-6 max-w-6xl mx-auto text-white">
      <AdminAnalyticsToolbar
        title="Odessa Daily Signals"
        view={view}
        setView={setView}
        onRefresh={fetchData}
        stats={stats}
      >
        <button
          onClick={downloadCSV}
          className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded text-white"
        >
          ⬇️ Export CSV
        </button>
      </AdminAnalyticsToolbar>

      <div className="bg-zinc-800 rounded p-6 mt-6">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={data}
            onClick={(e) => {
              const clicked = e?.activeLabel;
              if (clicked) alert(\`Drilldown for \${clicked}\`);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="date" stroke="#999" />
            <YAxis stroke="#999" />
            <Tooltip
              contentStyle={{ backgroundColor: '#222', borderColor: '#555' }}
              labelStyle={{ color: '#fff' }}
              formatter={(val, key) => [val, key === 'views' ? 'Views' : 'Feedback']}
            />
            <Line type="monotone" dataKey="views" stroke="#8884d8" strokeWidth={2} />
            <Line type="monotone" dataKey="feedback" stroke="#82ca9d" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
