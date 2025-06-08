'use client';
import { useEffect, useState } from 'react';

export default function ThankSupporters() {
  const [supporters, setSupporters] = useState<any[]>([]);
  const [sent, setSent] = useState({});

  useEffect(() => {
    fetch('/api/supporters?handle=me') // swap with actual handle
      .then(res => res.json())
      .then(setSupporters);
  }, []);

  return (
    <div className="max-w-xl mx-auto p-6 text-white space-y-4">
      <h1 className="text-2xl font-bold">🙏 Send Thanks</h1>
      {supporters.map((s: any) => (
        <div key={s.user_id} className="bg-zinc-800 p-3 rounded">
          <div className="text-green-400 text-sm mb-2">User: {s.user_id.slice(0, 8)}</div>
          <button
            disabled={sent[s.user_id]}
            onClick={async () => {
              const message = prompt('What would you like to say?');
              if (!message) return;
              await fetch('/api/send-thanks', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${localStorage.getItem('supabase.auth.token')}`
                },
                body: JSON.stringify({ recipient_id: s.user_id, block_id: 'N/A', message })
              });
              setSent((prev) => ({ ...prev, [s.user_id]: true }));
            }}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-1 text-sm rounded"
          >
            {sent[s.user_id] ? '✅ Sent' : 'Send Thanks'}
          </button>
        </div>
      ))}
    </div>
  );
}
