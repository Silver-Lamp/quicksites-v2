import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function AnalyticsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [filter, setFilter] = useState('');
  const [users, setUsers] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('user_action_logs').select('*').then(({ data, error }) => {
      if (error) setError(error.message);
      else {
        setLogs(data || []);
        setUsers([...new Set((data || []).map(d => d.triggered_by || '—'))]);
      }
    });
  }, []);

  const filtered = logs.filter((log) =>
    (userFilter ? log.triggered_by === userFilter : true) &&
    (actionFilter ? log.action_type === actionFilter : true) &&
    (filter ? (
      log.action_type.toLowerCase().includes(filter.toLowerCase()) ||
      (log.triggered_by || '').toLowerCase().includes(filter.toLowerCase())
    ) : true)
  );

  const dailyCounts = filtered.reduce((acc, log) => {
    const date = new Date(log.timestamp).toISOString().split('T')[0];
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedDates = Object.keys(dailyCounts).sort();
  const chartData = {
    labels: sortedDates,
    datasets: [
      {
        label: 'Actions per Day',
        data: sortedDates.map((d) => dailyCounts[d]),
        backgroundColor: '#3b82f6'
      }
    ]
  };

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">Analytics</h1>
      {error && <p className="text-red-500 mb-2">{error}</p>}
      <div className="mb-4 flex gap-4 items-center text-sm">
        <input
          placeholder="Search logs"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-2 py-1 rounded bg-gray-700 border border-gray-600"
        />
        <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded">
          <option value="">All Users</option>
          {users.map(u => <option key={u}>{u}</option>)}
        </select>
      </div>

      {sortedDates.length ? (
        <Bar data={chartData} options={{
          responsive: true,
          plugins: {
            legend: { display: false },
            title: { display: true, text: 'Actions per Day' }
          },
          scales: {
            x: { ticks: { color: '#ccc' }, grid: { color: '#444' } },
            y: { ticks: { color: '#ccc' }, grid: { color: '#444' } }
          }
        }} />
      ) : (
        <p className="text-gray-400">No data available for chart.</p>
      )}

      <table className="w-full mt-6 text-sm text-left text-gray-300 bg-gray-800 rounded">
        <thead className="bg-gray-700 text-gray-100 uppercase text-xs tracking-wide">
          <tr>
            <th className="px-4 py-2">Time</th>
            <th className="px-4 py-2">Action</th>
            <th className="px-4 py-2">User</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((log, i) => (
            <tr key={log.id} className={i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900'}>
              <td className="px-4 py-2">{new Date(log.timestamp).toLocaleString()}</td>
              <td className="px-4 py-2">{log.action_type}</td>
              <td className="px-4 py-2">{log.triggered_by || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
