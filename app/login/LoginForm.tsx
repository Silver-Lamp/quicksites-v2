// app/login/LoginForm.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type BuildInfo = { sha?: string; env?: string; deployId?: string };

const normalizeEmail = (raw: string) =>
  raw.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim().toLowerCase();

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default function LoginForm({ build }: { build?: BuildInfo }) {
  const sp = useSearchParams();

  const nextPath = useMemo(() => {
    const n = sp.get('next') || sp.get('redirectTo') || '/admin/tools';
    return n.startsWith('/') ? n : '/admin/tools';
  }, [sp]);

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // optional: prefill during local dev
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setEmail('sandon@pointsevenstudio.com');
    }
  }, []);

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isLoading) return;

    const emailNorm = normalizeEmail(email);
    if (!isValidEmail(emailNorm)) {
      setStatus('❌ Please enter a valid email.');
      return;
    }

    setIsLoading(true);
    setStatus('Sending magic link…');

    try {
      const body = { email: emailNorm, next: nextPath };
      console.debug('[login] POST /api/login body =', body);

      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({} as any));
      // Surface exactly what the server used
      if (data?.redirect || data?.origin) {
        console.debug('[login] /api/login response =', data);
      }

      if (!res.ok) {
        setStatus(`❌ ${data?.error || 'Login failed.'}`);
      } else {
        setStatus('✅ Check your email for the magic link.');
      }
    } catch (err: any) {
      console.error('[login] request error', err);
      setStatus('❌ Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const showDebug = process.env.NODE_ENV !== 'production';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-zinc-900 p-8 rounded-xl shadow-lg space-y-6">
        <label htmlFor="email" className="sr-only">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="you@example.com"
          className="w-full px-4 py-2 rounded-md bg-zinc-800 text-white border border-zinc-700 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={isLoading}
        />

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full text-white py-2 px-4 rounded ${isLoading ? 'bg-zinc-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isLoading ? 'Sending…' : 'Send Magic Link'}
        </button>

        {status && (
          <p
            className={`text-sm mt-4 ${
              status.startsWith('✅') ? 'text-green-400' :
              status.startsWith('❌') ? 'text-red-400' : 'text-yellow-400'
            }`}
          >
            {status}
          </p>
        )}

        {/* build stamp */}
        {build && (
          <p className="mt-6 text-center text-[10px] text-zinc-500">
            build <span className="font-mono">{build.sha}</span> • {build.env}
            {build.deployId ? <> • <span className="font-mono">{build.deployId}</span></> : null}
          </p>
        )}

        {/* dev-only debug footer */}
        {showDebug && (
          <div className="mt-2 text-center text-[10px] text-zinc-500">
            <span className="font-mono">next={nextPath}</span>
          </div>
        )}
      </form>
    </div>
  );
}
