'use client';
import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';
import { useUser } from '@supabase/auth-helpers-react';

export default function SummaryPage() {
  const user = useUser();
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    fetch('/api/feedback-summary?user_id=' + user.id)
      .then((res) => json())
      .then(setSummary);
  }, [user]);

  if (!summary) return <div className="p-6 text-white">Loading summary...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 text-white space-y-6">
      <h1 className="text-2xl font-bold">🧠 Weekly Summary</h1>

      <div>
        <h2 className="text-lg font-semibold mb-2">📥 Received Feedback</h2>
        {summary.received_feedback.length === 0 && (
          <p className="text-zinc-400">No feedback yet.</p>
        )}
        <ul className="space-y-2">
          {summary.received_feedback.map((f: any, i: number) => (
            <li key={i} className="bg-zinc-800 p-3 rounded text-sm">
              <span className="font-bold">{f.action}</span> on <code>{f.block_id.slice(0, 8)}</code>
              {f.message && <p className="italic mt-1 text-zinc-300">“{f.message}”</p>}
              <div className="text-xs text-zinc-400">{new Date(f.created_at).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2 mt-6">📆 Check-in History</h2>
        {summary.checkin_history.length === 0 && <p className="text-zinc-400">No check-ins yet.</p>}
        <ul className="space-y-2">
          {summary.checkin_history.map((c: any, i: number) => (
            <li key={i} className="bg-zinc-900 p-2 rounded text-sm">
              ✅ <strong>{c.slug}</strong> @ {new Date(c.created_at).toLocaleString()}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
