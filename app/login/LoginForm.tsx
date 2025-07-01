// app/login/LoginForm.tsx
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');

  const sendMagicLink = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback',
      },
    });

    if (error) {
      console.error('[❌ Magic Link Error]', error);
      setStatus('Error sending link.');
    } else {
      setStatus('Magic link sent! Check your inbox.');
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-bold mb-4 text-white">Login</h1>
      <input
        className="w-full p-2 mb-3 border border-zinc-600 bg-zinc-800 text-white rounded"
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
        onClick={sendMagicLink}
      >
        Send Magic Link
      </button>
      {status && <p className="text-sm text-zinc-300 mt-4">{status}</p>}
    </div>
  );
}
