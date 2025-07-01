'use client';
import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';

type Supporter = {
  user_id: string;
};

export default function ThankSupporters() {
  const [supporters, setSupporters] = useState<Supporter[]>([]);
  const [sent, setSent] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/supporters?handle=me') // TODO: replace 'me' with dynamic handle
      .then((res) => res.json())
      .then(setSupporters)
      .catch((err) => console.error('Failed to load supporters:', err));
  }, []);

  const handleSendThanks = async (userId: string) => {
    const message = prompt('What would you like to say?');
    if (!message) return;

    try {
      await fetch('/api/send-thanks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('supabase.auth.token') || ''}`,
        },
        body: JSON.stringify({
          recipient_id: userId,
          block_id: 'N/A', // Replace if needed
          message,
        }),
      });

      setSent((prev) => ({ ...prev, [userId]: true }));
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Failed to send. Please try again.');
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 text-white space-y-4">
      <h1 className="text-2xl font-bold">🙏 Send Thanks</h1>
      {supporters.map((s) => (
        <div key={s.user_id} className="bg-zinc-800 p-3 rounded">
          <div className="text-green-400 text-sm mb-2">User: {s.user_id.slice(0, 8)}</div>
          <button
            disabled={sent[s.user_id]}
            onClick={() => handleSendThanks(s.user_id)}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-1 text-sm rounded disabled:opacity-50"
          >
            {sent[s.user_id] ? '✅ Sent' : 'Send Thanks'}
          </button>
        </div>
      ))}
    </div>
  );
}
