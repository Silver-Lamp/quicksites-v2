'use client';
import { useEffect, useState } from 'react';

export default function AdminDigestPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [sending, setSending] = useState(false);

  const fetchLogs = async () => {
    const res = await fetch('/api/digest-log');
    const json = await res.json();
    setLogs(json || []);
  };

  const triggerDigest = async () => {
    setSending(true);
    await fetch('/api/send-weekly-digest');
    await fetchLogs();
    setSending(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto text-white space-y-6">
      <h1 className="text-2xl font-bold">📡 Weekly Digest Admin</h1>
      <button
        onClick={triggerDigest}
        className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
        disabled={sending}
      >
        {sending ? 'Sending...' : 'Send All Now'}
      </button>

      <div className="pt-6">
        <h2 className="text-lg font-semibold mb-2">Last Sent</h2>
        <ul className="space-y-4">
          {logs.map((l: any) => (
            <li key={l.id} className="bg-zinc-800 p-4 rounded text-sm">
              <div className="text-xs text-zinc-400">{l.sent_at}</div>
              <pre className="whitespace-pre-wrap mt-2 text-green-300">{l.summary}</pre>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
