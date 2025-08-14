import { createClient } from '@supabase/supabase-js';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function CallLogsPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: logs, error } = await supabase
    .from('call_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(50);

  return (
    <div className="p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          📞 Twilio Call Logs
        </h2>

        <div className="rounded border border-zinc-700 bg-black/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-800/50 text-left text-zinc-400 uppercase text-xs">
              <tr>
                <th className="px-4 py-2">From</th>
                <th className="px-4 py-2">To</th>
                <th className="px-4 py-2">Direction</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Duration</th>
                <th className="px-4 py-2 text-right">Time</th>
                <th className="px-4 py-2">Site</th>
              </tr>
            </thead>
            <tbody>
              {logs?.map(log => (
                <tr key={log.call_sid} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                  <td className="px-4 py-2 font-mono text-zinc-100">{log.from_number}</td>
                  <td className="px-4 py-2 font-mono text-zinc-100">{log.to_number}</td>
                  <td className="px-4 py-2 capitalize text-zinc-300">{log.direction}</td>
                  <td className="px-4 py-2 capitalize text-green-400">{log.call_status}</td>
                  <td className="px-4 py-2 text-right text-zinc-200">
                    {log.call_duration ? `${log.call_duration}s` : '-'}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-400 text-xs">
                    {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {log.custom_domain ? (
                      <a
                        href={`https://${log.custom_domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        {log.custom_domain}
                      </a>
                    ) : log.template_slug ? (
                      <Link
                        href={`/sites/${log.template_slug}`}
                        className="text-blue-400 hover:underline"
                      >
                        {log.template_slug}
                      </Link>
                    ) : (
                      <span className="text-zinc-500 italic">No match</span>
                    )}
                  </td>
                </tr>
              ))}

              {logs?.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center px-4 py-8 text-zinc-500">
                    No call logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
