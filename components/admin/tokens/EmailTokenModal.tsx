'use client';
import { useState } from 'react';

export default function EmailTokenModal({
  file,
  onClose,
}: {
  file: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const send = () => {
    alert(
      `(Simulated) Sent tokenized link for ${file} to ${email}, expires at ${expiresAt}`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 p-6 rounded shadow-lg w-full max-w-sm space-y-3">
        <h2 className="text-lg font-semibold text-white">
          📬 Share Tokenized Link
        </h2>
        <input
          type="email"
          placeholder="Recipient email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-2 py-1 rounded bg-zinc-800 border border-zinc-700"
        />
        <input
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="w-full px-2 py-1 rounded bg-zinc-800 border border-zinc-700"
        />
        <button
          onClick={send}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Send Link
        </button>
        <button
          onClick={onClose}
          className="w-full px-3 py-1 text-sm mt-2 text-zinc-400 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
