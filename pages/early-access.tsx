'use client';
import { NextSeo } from 'next-seo';
const seo = usePageSeo({
  description: 'Early access page.',
});

import { usePageSeo } from '@/lib/usePageSeo';
import { useState } from 'react';

export default function EarlyAccessPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    await fetch('/api/early-access', {
      method: 'POST',
      body: JSON.stringify({ email, name, invite_code: code }),
    });
    setSubmitted(true);
  };

  return (
    <>
      <NextSeo {...seo} />
      <div className="p-6 text-white max-w-md mx-auto text-center">
        <h1 className="text-3xl font-bold mb-4">🚀 Early Access</h1>
        <p className="text-zinc-400 mb-4">
          Get notified when QuickSites opens. Trusted testers may receive access
          early.
        </p>

        {!submitted ? (
          <>
            <input
              className="w-full mb-2 p-2 bg-zinc-800 rounded"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="w-full mb-2 p-2 bg-zinc-800 rounded"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="w-full mb-4 p-2 bg-zinc-800 rounded"
              placeholder="Invite Code (optional)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
              onClick={submit}
            >
              Submit
            </button>
          </>
        ) : (
          <p className="text-green-400 font-medium mt-6">
            ✅ Request received. We'll be in touch soon!
          </p>
        )}
      </div>
    </>
  );
}
