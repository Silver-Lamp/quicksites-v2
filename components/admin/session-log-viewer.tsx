'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient.js';

export default function SessionLogViewer({ mobileOnly = false }: { mobileOnly?: boolean }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let query = supabase.from('session_logs').select('*');
    if (mobileOnly) query = query.eq('is_mobile', true);

    query
      .order('timestamp', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) console.error('Failed to fetch session logs:', error);
        setLogs(data || []);
        setLoading(false);
      });
  }, [mobileOnly]);

  if (loading) {
    return <p className="text-gray-400 text-sm p-4">Loading session logs…</p>;
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4 text-white">Session Logs</h2>
      <table className="w-full text-sm border border-gray-700">
        <thead>
          <tr className="bg-gray-800 text-left text-gray-300">
            <th className="p-2">Type</th>
            <th className="p-2">Event</th>
            <th className="p-2">Email</th>
            <th className="p-2">Token</th>
            <th className="p-2">Device</th>
            <th className="p-2">Mobile</th>
            <th className="p-2">Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-gray-700">
              <td className="p-2">{log.type}</td>
              <td className="p-2">{log.event || '-'}</td>
              <td className="p-2 text-blue-300">{log.email}</td>
              <td className="p-2 text-xs">
                {log.token_start}...{log.token_end}
              </td>
              <td className="p-2 truncate text-xs text-gray-400">{log.device?.slice(0, 40)}…</td>
              <td className="p-2">{log.is_mobile ? '✅' : '—'}</td>
              <td className="p-2 text-xs text-gray-400">
                {new Date(log.timestamp).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
