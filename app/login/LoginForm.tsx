// app/login/LoginForm.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

function normalizeEmail(raw: string) {
  return raw.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim().toLowerCase();
}
function isValidEmail(raw: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(raw));
}

export default function LoginForm() {
  const sp = useSearchParams();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // support both ?next=/path and legacy ?redirectTo=/path
  const nextPath = useMemo(() => {
    const n = sp.get('next') || sp.get('redirectTo') || '/admin/tools';
    return n.startsWith('/') ? n : '/admin/tools';
  }, [sp]);

  // Hash-capture fallback for non-PKCE magic links: #access_token & #refresh_token
  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (!hash || !hash.includes('access_token')) return;

    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    const typ = params.get('type');

    if (access_token && refresh_token && (typ === 'magiclink' || !typ)) {
      setIsLoading(true);
      setStatus('Signing you in…');

      (async () => {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        // Clean the hash so tokens aren’t left in the address bar
        history.replaceState(null, document.title, window.location.pathname + window.location.search);

        if (error) {
          console.error('[setSession error]', error);
          setStatus('❌ Could not complete sign-in. Please try again.');
          setIsLoading(false);
          return;
        }
        router.replace(nextPath);
      })();
    }
  }, [router, nextPath]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') setEmail('sandon@pointsevenstudio.com');
  }, []);

  async function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setStatus(null);

    const emailNorm = normalizeEmail(email);
    if (!isValidEmail(emailNorm)) {
      setStatus('❌ Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      // Prefer an explicit prod override if provided (handy safety on prod)
      const explicit = process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL;

      let redirect: string;
      if (typeof window !== 'undefined') {
        const u = new URL(explicit || '/auth/callback', explicit ? undefined : window.location.href);
        u.searchParams.set('next', nextPath);
        redirect = u.toString();
      } else {
        const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const u = new URL('/auth/callback', base);
        u.searchParams.set('next', nextPath);
        redirect = u.toString();
      }

      console.debug('[login] emailRedirectTo =', redirect);

      const { error } = await supabase.auth.signInWithOtp({
        email: emailNorm,
        options: { emailRedirectTo: redirect },
      });

      if (error) {
        console.error('[Magic Link Error]', error);
        setStatus('❌ Error sending link. Please try again.');
      } else {
        setStatus('✅ Magic link sent! Check your inbox.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-zinc-900 p-8 rounded-xl shadow-lg space-y-6">
        <h1 className="text-2xl font-extrabold text-center">Login</h1>

        <label className="block text-sm text-muted-foreground" htmlFor="email">Email</label>
        <input
          id="email" type="email" inputMode="email" autoComplete="email"
          className="w-full p-2 mb-1 border border-zinc-600 bg-zinc-800 text-white rounded"
          placeholder="you@yourdomain.com"
          value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">We’ll email you a one-time sign-in link.</p>

        <button
          type="submit"
          className={`w-full text-white py-2 px-4 rounded ${isLoading ? 'bg-zinc-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          disabled={isLoading}
        >
          {isLoading ? 'Sending…' : 'Send Magic Link'}
        </button>

        {status && (
          <p className={`text-sm mt-4 ${status.startsWith('✅') ? 'text-green-400' : status.startsWith('❌') ? 'text-red-400' : 'text-yellow-400'}`}>
            {status}
          </p>
        )}
      </form>
    </div>
  );
}
