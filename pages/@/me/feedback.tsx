'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@supabase/auth-helpers-react';

export default function MyFeedback() {
  const user = useUser();
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/feedback-history?type=received&user_id=' + user.id)
      .then(res => res.json())
      .then(setReceived);

    fetch('/api/feedback-history?type=sent&user_id=' + user.id)
      .then(res => res.json())
      .then(setSent);
  }, [user]);

  return (
    <div className="p-6 text-white max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">🧾 Feedback</h1>

      <div>
        <h2 className="text-xl font-semibold mb-2">🎯 Received</h2>
        {received.length === 0 && <p className="text-zinc-400 text-sm">Nothing yet.</p>}
        <ul className="space-y-2">
          {received.map((f: any) => (
            <li key={f.id} className="bg-zinc-800 p-3 rounded text-sm">
              <span className="font-bold">{f.action}</span> on <code>{f.block_id.slice(0, 8)}</code>
              {f.message && <p className="text-zinc-300 mt-1 italic">“{f.message}”</p>}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-xl font-semibold mt-6 mb-2">📤 Sent</h2>
        {sent.length === 0 && <p className="text-zinc-400 text-sm">No outgoing feedback yet.</p>}
        <ul className="space-y-2">
          {sent.map((f: any) => (
            <li key={f.id} className="bg-zinc-800 p-3 rounded text-sm">
              <span className="font-bold">{f.action}</span> to block <code>{f.block_id.slice(0, 8)}</code>
              {f.message && <p className="text-zinc-300 mt-1 italic">“{f.message}”</p>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
