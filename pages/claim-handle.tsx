'use client';
import { useState } from 'react';
import { json } from '@/lib/api/json';

export default function ClaimHandlePage() {
  const [handle, setHandle] = useState('');
  const [message, setMessage] = useState('');

  const submit = async () => {
    const res = await fetch('/api/claim-handle', {
      method: 'POST',
      body: JSON.stringify({ handle }),
    });
    const result = await json();
    setMessage(result.message || 'Saved');
  };

  return (
    <div className="p-6 text-white max-w-md mx-auto text-center">
      <h1 className="text-2xl font-bold mb-4">🔖 Claim Your Handle</h1>
      <input
        className="w-full mb-4 p-2 rounded bg-zinc-800"
        value={handle}
        onChange={(e) => setHandle(e.target.value.toLowerCase())}
        placeholder="@yourname"
      />
      <button
        onClick={submit}
        className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700"
      >
        Claim
      </button>
      {message && <p className="mt-4 text-sm text-zinc-400">{message}</p>}
    </div>
  );
}
