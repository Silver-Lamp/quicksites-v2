import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/admin/lib/supabaseClient';
import { format } from 'date-fns-tz';
import { formatDistanceToNow } from 'date-fns';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { CSVLink } from 'react-csv';

export default function AdminAuditPage() {
  const router = useRouter();
  const queryPage = parseInt(router.query.page as string) || 1;
  const { role } = useCurrentUser();
  const [logs, setLogs] = useState<any[]>([]);
  const [since, setSince] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState(queryPage);
  const [showUtc, setShowUtc] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('audit_show_utc') === 'true';
    }
    return false;
  });
  const [pageSize] = useState(10);

  useEffect(() => {
    let query = supabase.from('user_deletion_logs').select('*');
    if (since) query = query.gte('deleted_at', since);
    query.order('deleted_at', { ascending: false }).then(({ data }) => {
      if (data) {
        const filtered = search
          ? data.filter((d) => d.email?.toLowerCase().includes(search.toLowerCase()))
          : data;
        setLogs(filtered);
      }
    });
  }, [since, search]);

  if (role !== 'admin' && role !== 'owner')
    return <div className="text-center py-20 text-zinc-400">Access restricted</div>;

  return (
    <div className="max-w-5xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-6">User Deletion Logs</h1>
      <p className="text-sm text-zinc-400 mb-6">
        This page shows all users who have deleted their accounts. Logs are generated automatically
        by the <code className="bg-zinc-800 px-1 rounded">delete_current_user_with_log</code>{' '}
        function.
      </p>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <label className="block text-xs mb-1 text-zinc-400">Filter since:</label>
          <input
            type="date"
            className="bg-zinc-800 border border-zinc-600 text-white rounded px-2 py-1 text-sm"
            value={since}
            onChange={(e) => setSince(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs mb-1 text-zinc-400">Search email:</label>
          <input
            type="text"
            className="bg-zinc-800 border border-zinc-600 text-white rounded px-2 py-1 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. user@example.com"
          />
        </div>
        <CSVLink
          data={logs}
          filename="deletion_logs.csv"
          className="text-xs bg-zinc-700 px-3 py-1 rounded hover:bg-zinc-600 text-white"
        >
          Download CSV
        </CSVLink>
      </div>

      <div className="mb-4 flex justify-end">
        <button
          className="text-xs bg-zinc-700 px-2 py-1 rounded hover:bg-zinc-600 border border-zinc-500"
          onClick={() => {
            setShowUtc((v) => {
              const next = !v;
              localStorage.setItem('audit_show_utc', String(next));
              return next;
            });
          }}
        >
          Toggle UTC
        </button>
      </div>

      <div className="overflow-x-auto border border-zinc-700 rounded-md">
        <table className="w-full text-sm text-left text-zinc-300">
          <thead className="bg-zinc-800 text-zinc-400 text-xs uppercase">
            <tr>
              <th className="px-4 py-2">User ID</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Deleted At</th>
            </tr>
          </thead>
          <tbody>
            {logs.slice((page - 1) * pageSize, page * pageSize).map((log) => (
              <tr key={log.id} className="border-t border-zinc-700 hover:bg-zinc-800/50">
                <td className="px-4 py-2 font-mono text-xs">{log.user_id}</td>
                <td className="px-4 py-2">{log.email}</td>
                <td className="px-4 py-2">
                  <div>{format(new Date(log.deleted_at), 'yyyy-MM-dd HH:mm zzz')}</div>
                  <div className="text-xs text-zinc-500">
                    {formatDistanceToNow(new Date(log.deleted_at), {
                      addSuffix: true,
                    })}
                  </div>
                  {showUtc && (
                    <div className="text-xs text-yellow-400">
                      UTC: {format(new Date(log.deleted_at), 'yyyy-MM-dd HH:mm')} UTC
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-4 text-xs text-zinc-400">
        <button
          className="px-3 py-1 rounded border border-zinc-700 hover:bg-zinc-800 disabled:opacity-50"
          onClick={() => {
            const nextPage = Math.max(1, page - 1);
            router.push({ query: { ...router.query, page: nextPage } });
            setPage(nextPage);
          }}
          disabled={page === 1}
        >
          Previous
        </button>
        <span>
          Page {page} of {Math.ceil(logs.length / pageSize) || 1}
        </span>
        <button
          className="px-3 py-1 rounded border border-zinc-700 hover:bg-zinc-800 disabled:opacity-50"
          onClick={() => {
            const nextPage = page + 1;
            router.push({ query: { ...router.query, page: nextPage } });
            setPage(nextPage);
          }}
          disabled={page * pageSize >= logs.length}
        >
          Next
        </button>
      </div>
    </div>
  );
}
