'use client';
import { useState } from 'react';

export default function EarlyAccess() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    await fetch('/api/waitlist', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    setSubmitted(true);
  };

  return (
    <div className="max-w-lg mx-auto text-white p-6 text-center">
      <h1 className="text-3xl font-bold mb-4">🚀 Get Early Access</h1>
      <p className="text-zinc-400 mb-4">
        Sign up to get early access to QuickSites before public launch.
      </p>
      {!submitted ? (
        <>
          <input
            type="email"
            placeholder="you@example.com"
            className="bg-zinc-800 rounded p-2 w-full mb-3 text-white"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            onClick={submit}
            className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded text-white"
          >
            Join Waitlist
          </button>
        </>
      ) : (
        <p className="text-green-400 font-medium">You&apos;re on the list!</p>
      )}
    </div>
  );
}
