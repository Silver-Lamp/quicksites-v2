'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setEmail('sandon@quicksites.ai');
    }
  }, []);

  const sendMagicLink = async () => {
    setIsLoading(true);
    setStatus('');

    const isDev = process.env.NODE_ENV === 'development';

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: isDev
        ? {} // 🧪 Dev mode: legacy redirect
        : {
            emailRedirectTo: 'http://localhost:3000/auth/callback', // ✅ Production PKCE
          },
    });

    setIsLoading(false);

    if (error) {
      console.error('[❌ Magic Link Error]', error);
      setStatus('❌ Error sending link. Please try again.');
    } else {
      setStatus('✅ Magic link sent! Check your inbox.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <div className="w-full max-w-md bg-zinc-900 p-8 rounded-xl shadow-lg space-y-6">
        <h1 className="text-2xl font-extrabold text-center">Login</h1>
        <input
          className="w-full p-2 mb-3 border border-zinc-600 bg-zinc-800 text-white rounded"
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
        />
        <button
          className={`w-full text-white py-2 px-4 rounded ${
            isLoading
              ? 'bg-zinc-700 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
          onClick={sendMagicLink}
          disabled={isLoading}
        >
          {isLoading ? 'Sending...' : 'Send Magic Link'}
        </button>
        {status && (
          <p
            className={`text-sm mt-4 ${
              status.includes('✅')
                ? 'text-green-400'
                : status.includes('❌')
                ? 'text-red-400'
                : 'text-yellow-400'
            }`}
          >
            {status}
          </p>
        )}
      </div>
    </div>
  );
}
