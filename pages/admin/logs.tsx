import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import AdminTabs from '@/components/admin/AdminTabs';

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('user_action_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setLogs(data || []);
      });
  }, []);

  const filtered = logs.filter(
    (log) =>
      log.action_type.toLowerCase().includes(filter.toLowerCase()) ||
      (log.triggered_by || '').toLowerCase().includes(filter.toLowerCase())
  );

  const exportCSV = () => {
    const rows = filtered.map(
      (log) =>
        `"${log.timestamp}","${log.action_type}","${log.triggered_by || ''}","${log.lead_id}","${log.domain_id}"`
    );
    const csv = 'Timestamp,Action,User,Lead,Domain\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'user_action_logs.csv';
    a.click();
  };

  return (
    <>
      <AdminTabs />
      <div className="p-6 text-white">
        <h1 className="text-xl font-bold mb-4">Lead Logs</h1>
        <div className="mb-4 flex items-center gap-3">
          <input
            type="text"
            placeholder="Search logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-2 py-1 rounded bg-gray-700 border border-gray-500 text-sm"
          />
          <button
            onClick={exportCSV}
            className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm text-white"
          >
            Export CSV
          </button>
        </div>
        <table className="w-full text-sm text-left text-gray-300 bg-gray-800 rounded overflow-hidden">
          <thead className="bg-gray-700 text-gray-100 uppercase text-xs tracking-wide">
            <tr>
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Lead ID</th>
              <th className="px-4 py-2">Domain ID</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log, i) => (
              <tr
                key={log.id}
                className={i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900'}
              >
                <td className="px-4 py-2">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-2">{log.action_type}</td>
                <td className="px-4 py-2">{log.triggered_by || '—'}</td>
                <td className="px-4 py-2 text-xs">{log.lead_id}</td>
                <td className="px-4 py-2 text-xs">{log.domain_id || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
