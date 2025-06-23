import { useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';

export default function QueuePage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from('regeneration_queue')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) setError(error.message);
    else setQueue(data || []);
  };

  useEffect(() => {
    load();
    const interval = setInterval(() => load(), 5000);
    return () => clearInterval(interval);
  }, []);

  const statusStyle = (status: string) => {
    switch (status) {
      case 'queued':
        return 'bg-gray-600 text-white px-2 py-1 rounded text-xs';
      case 'processing':
        return 'bg-yellow-500 text-black px-2 py-1 rounded text-xs animate-pulse';
      case 'done':
        return 'bg-green-600 text-white px-2 py-1 rounded text-xs';
      case 'error':
        return 'bg-red-600 text-white px-2 py-1 rounded text-xs';
      case 'cancelled':
        return 'bg-gray-500 text-white px-2 py-1 rounded text-xs';
      default:
        return 'bg-gray-400 text-white px-2 py-1 rounded text-xs';
    }
  };

  const retryJob = async (id: string) => {
    await fetch('/api/queue/retry', {
      method: 'POST',
      body: JSON.stringify({ id }),
      headers: { 'Content-Type': 'application/json' },
    });
    load();
  };

  const cancelJob = async (id: string) => {
    await fetch('/api/queue/cancel', {
      method: 'POST',
      body: JSON.stringify({ id }),
      headers: { 'Content-Type': 'application/json' },
    });
    load();
  };

  const toggleRetryEnabled = async (id: string, current: boolean) => {
    await supabase.from('regeneration_queue').update({ retry_enabled: !current }).eq('id', id);
    load();
  };

  return (
    <div className="p-6 text-white">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Regeneration Queue</h1>
        <button
          onClick={() =>
            fetch('/api/queue/retry-all', { method: 'POST' }).then(() => window.location.reload())
          }
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
        >
          Retry All Failed
        </button>
      </div>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <table className="w-full text-sm text-left text-gray-300 bg-gray-800 rounded overflow-hidden">
        <thead className="bg-gray-700 text-gray-100 uppercase text-xs tracking-wide">
          <tr>
            <th className="px-4 py-2">Domain</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Retry?</th>
            <th className="px-4 py-2">Created</th>
            <th className="px-4 py-2">Started</th>
            <th className="px-4 py-2">Finished</th>
            <th className="px-4 py-2">Triggered By</th>
            <th className="px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {queue.map((q, i) => (
            <>
              <tr key={q.id} className={i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900'}>
                <td className="px-4 py-2">{q.domain}</td>
                <td className="px-4 py-2">
                  <span className={statusStyle(q.status)}>{q.status}</span>
                </td>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={q.retry_enabled}
                    onChange={() => toggleRetryEnabled(q.id, q.retry_enabled)}
                  />
                </td>
                <td className="px-4 py-2">
                  {q.created_at ? new Date(q.created_at).toLocaleString() : ''}
                </td>
                <td className="px-4 py-2">
                  {q.started_at ? new Date(q.started_at).toLocaleString() : ''}
                </td>
                <td className="px-4 py-2">
                  {q.finished_at ? new Date(q.finished_at).toLocaleString() : ''}
                </td>
                <td className="px-4 py-2">{q.triggered_by || '—'}</td>
                <td className="px-4 py-2 space-x-2">
                  {q.status === 'error' && (
                    <button
                      className="text-blue-400 hover:underline"
                      onClick={() => retryJob(q.id)}
                    >
                      Retry
                    </button>
                  )}
                  {(q.status === 'queued' || q.status === 'processing') && (
                    <button
                      className="text-red-400 hover:underline"
                      onClick={() => cancelJob(q.id)}
                    >
                      Cancel
                    </button>
                  )}
                  {q.log && (
                    <button
                      className="text-gray-300 hover:underline"
                      onClick={() => setExpanded(expanded === q.id ? null : q.id)}
                    >
                      {expanded === q.id ? 'Hide Log' : 'View Log'}
                    </button>
                  )}
                </td>
              </tr>
              {expanded === q.id && q.log && (
                <tr className="bg-black">
                  <td colSpan={7} className="p-4 text-green-200 font-mono whitespace-pre-wrap">
                    {q.log}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
