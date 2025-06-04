import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function ActivityFeed({ domain_id, lead_id }: { domain_id?: string; lead_id?: string }) {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const query = supabase.from('user_action_logs').select('*').order('timestamp', { ascending: false });
    if (domain_id) {
      query.eq('domain_id', domain_id).then(({ data }) => setLogs(data || []));
    } else if (lead_id) {
      query.eq('lead_id', lead_id).then(({ data }) => setLogs(data || []));
    }
  }, [domain_id, lead_id]);

  return (
    <div className="text-sm text-gray-300 mt-4">
      <h2 className="text-sm font-bold mb-2 text-gray-400">Activity Feed</h2>
      {logs.length === 0 && <p className="text-xs text-gray-500">No activity yet.</p>}
      <ul className="space-y-2">
        {logs.map((log, i) => (
          <li key={log.id} className="bg-gray-900 px-3 py-2 rounded">
            <div className="text-xs text-green-400">
              {new Date(log.timestamp).toLocaleString()}
            </div>
            <div className="text-xs">
              {log.action_type.replace(/_/g, ' ')} by <strong>{log.triggered_by || '—'}</strong>
            </div>
            {log.notes && <div className="text-xs italic text-gray-400 mt-1">{log.notes}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
