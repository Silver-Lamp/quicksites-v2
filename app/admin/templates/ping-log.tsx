'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Label } from '@/components/ui/label';

type Log = {
  id: string;
  created_at: string;
  status: string;
  error?: string;
  sitemap_url: string;
};

export default function PingLogViewer() {
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from('sitemap_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) setLogs(data);
    };

    fetchLogs();
  }, []);

  return (
    <div className="mt-6 space-y-2">
      <Label className="text-white text-lg">Recent Sitemap Pings</Label>
      {logs.length === 0 && <p className="text-sm text-gray-400">No logs yet.</p>}
      <ul className="text-sm text-white/80 space-y-1">
        {logs.map((log) => (
          <li key={log.id} className="border-b border-white/10 pb-1">
            <span className="text-green-400">{log.status.toUpperCase()}</span> —{' '}
            {new Date(log.created_at).toLocaleString()}
            {log.error && <p className="text-red-400 text-xs mt-1">Error: {log.error}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
