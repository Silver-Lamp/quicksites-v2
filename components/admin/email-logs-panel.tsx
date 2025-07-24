'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { formatDistanceToNow } from 'date-fns';

export default function EmailLogsPanel() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) console.error('[EmailLogsPanel] Error:', error);
      else setLogs(data || []);

      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-sm text-gray-400">Loading email logs...</p>;

  return (
    <div className="p-6 bg-white dark:bg-neutral-900 text-black dark:text-white rounded shadow max-w-full overflow-auto">
      <h2 className="text-2xl font-bold mb-6 text-blue-900 dark:text-white">📬 Email Logs</h2>
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-200 dark:bg-neutral-800 text-gray-800 dark:text-gray-300">
            <tr>
              <th className="px-4 py-2">📩 To</th>
              <th className="px-4 py-2">👤 User</th>
              <th className="px-4 py-2">📌 Subject</th>
              <th className="px-4 py-2">🧱 Slug</th>
              <th className="px-4 py-2">⏱️ Time</th>
              <th className="px-4 py-2">✅ Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-300 dark:divide-neutral-700">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-100 dark:hover:bg-neutral-800">
                <td className="px-4 py-2 text-wrap break-all">{log.to?.join(', ')}</td>
                <td className="px-4 py-2">{log.user_email || '-'}</td>
                <td className="px-4 py-2">{log.subject}</td>
                <td className="px-4 py-2 text-blue-600 dark:text-blue-300">{log.site_slug || '-'}</td>
                <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                  {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      log.status === 'sent'
                        ? 'bg-green-200 text-green-900 dark:bg-green-700 dark:text-white'
                        : 'bg-red-200 text-red-900 dark:bg-red-700 dark:text-white'
                    }`}
                  >
                    {log.status}
                  </span>
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                  No email logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
