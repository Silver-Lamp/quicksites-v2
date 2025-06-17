import { useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';

export default function BrandingAuditPanel({
  profileId,
}: {
  profileId: string;
}) {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from('branding_logs')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setLogs(data || []));
  }, [profileId]);

  if (!logs.length) return null;

  return (
    <div className="mt-4 p-4 border rounded bg-gray-50">
      <h4 className="font-semibold mb-2 text-sm">Audit Log</h4>
      <ul className="text-xs space-y-1">
        {logs.map((log) => (
          <li key={log.id}>
            <span className="font-mono">
              {new Date(log.created_at).toLocaleString()}
            </span>{' '}
            — {log.event}
            {log.details && (
              <span className="ml-1 text-gray-500">({log.details})</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
