// app/admin/not-found.tsx
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { cn } from '../lib/utils.js'; // Optional helper for conditional classNames

type LogEntry = {
  id: string;
  path: string;
  referrer: string | null;
  user_agent: string;
  ip: string;
  timestamp: string;
  context: 'admin' | 'public';
  isNew?: boolean;
};

export default function NotFoundLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'admin' | 'public'>('all');

  useEffect(() => {
    let mounted = true;

    // Initial load
    supabase
      .from('not_found_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) console.error('Error loading logs', error);
        else setLogs(data || []);
        setLoading(false);
      });

    // Realtime inserts
    const channel = supabase
      .channel('realtime-404')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'not_found_logs',
        },
        (payload) => {
          const newLog: LogEntry = { ...payload.new, isNew: true } as LogEntry;
          setLogs((prev) => [newLog, ...prev.slice(0, 99)]);

          // Remove isNew after 3s
          setTimeout(() => {
            setLogs((current) =>
              current.map((log) => (log.id === newLog.id ? { ...log, isNew: false } : log))
            );
          }, 3000);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const visibleLogs = logs.filter((log) => (filter === 'all' ? true : log.context === filter));

  return (
    <main className="p-6 bg-zinc-900 min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-4">🧭 404 Not Found Logs</h1>

      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-zinc-400">Filter:</span>
        {['all', 'public', 'admin'].map((opt) => (
          <button
            key={opt}
            onClick={() => setFilter(opt as 'all' | 'public' | 'admin')}
            className={cn(
              'px-3 py-1 text-sm rounded border border-zinc-700',
              filter === opt
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            )}
          >
            {opt}
          </button>
        ))}
      </div>

      <p className="text-sm text-zinc-500 mb-2">
        Showing {visibleLogs.length} {filter === 'all' ? '' : `${filter} `}
        log(s)
      </p>

      {loading ? (
        <p>Loading...</p>
      ) : visibleLogs.length === 0 ? (
        <p className="text-zinc-400">No logs yet.</p>
      ) : (
        <table className="w-full text-sm table-fixed border border-zinc-700">
          <thead>
            <tr className="bg-zinc-800 text-left">
              <th className="p-2 border-r border-zinc-700">Time</th>
              <th className="p-2 border-r border-zinc-700">Path</th>
              <th className="p-2 border-r border-zinc-700">Referrer</th>
              <th className="p-2 border-r border-zinc-700">IP</th>
              <th className="p-2">Context</th>
            </tr>
          </thead>
          <tbody>
            {visibleLogs.map((log) => (
              <tr
                key={log.id}
                className={cn(
                  'border-t border-zinc-700 transition-colors',
                  log.isNew && 'border-l-4 border-green-500 bg-green-950 animate-pulse'
                )}
              >
                <td className="p-2 whitespace-nowrap text-zinc-400">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="p-2 break-all">{log.path}</td>
                <td className="p-2 break-all">{log.referrer || '—'}</td>
                <td className="p-2">{log.ip}</td>
                <td className="p-2">{log.context}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
