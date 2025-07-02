'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setEmail('sandon@quicksites.ai');
    }

    // Show error from callback redirect
    const errorParam = searchParams.get('error');
    if (errorParam === 'exchange_failed') {
      setStatus('❌ Login failed. Please try again or request a new link.');
    }
  }, []);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const sendMagicLink = async () => {
    setIsLoading(true);
    setStatus('');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback',
      },
    });

    setIsLoading(false);

    if (error) {
      console.error('[❌ Magic Link Error]', error);
      if (
        error.name === 'AuthApiError' &&
        error.message.includes('you can only request this after')
      ) {
        setStatus('⏳ Too many requests. Please wait a minute and try again.');
        setCooldown(60);
      } else {
        setStatus('❌ Error sending link. Please try again.');
      }
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
          disabled={isLoading || cooldown > 0}
        />
        <button
          className={`w-full text-white py-2 px-4 rounded ${
            isLoading || cooldown > 0
              ? 'bg-zinc-700 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
          onClick={sendMagicLink}
          disabled={isLoading || cooldown > 0}
        >
          {isLoading
            ? 'Sending...'
            : cooldown > 0
            ? `Please wait (${cooldown}s)`
            : 'Send Magic Link'}
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
