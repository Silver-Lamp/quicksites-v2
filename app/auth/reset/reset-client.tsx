'use client';

// Password-reset finalize page. The reset email link lands here with a recovery token in
// the URL fragment; @supabase/supabase-js (implicit flow, detectSessionInUrl) parses it and
// fires PASSWORD_RECOVERY, giving us a short-lived recovery session. We take a new password,
// call updateUser, then bridge the session into server cookies (same path as login).

import { SignInLink } from '@/components/auth/auth-links';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient as createBrowserClient } from '@supabase/supabase-js';
import { finalizeBrowserSession } from '@/lib/auth/browserSession';

export default function ResetClient() {
  const sp = useSearchParams();
  const nextPath = useMemo(() => {
    const n = sp.get('next') || '/admin/templates/list';
    return n.startsWith('/') ? n : '/admin/templates/list';
  }, [sp]);

  const sb = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true } }
      ),
    []
  );

  const [ready, setReady] = useState(false);     // recovery session established?
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Detect the recovery session: either the PASSWORD_RECOVERY event, or an already-parsed
  // session on mount (detectSessionInUrl consumes the fragment quickly).
  useEffect(() => {
    let cancelled = false;
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });
    sb.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) setReady(true);
    });
    // Give detectSessionInUrl a beat, then surface a clear error if no token arrived.
    const t = setTimeout(() => {
      if (!cancelled) {
        sb.auth.getSession().then(({ data }) => {
          if (!cancelled && !data.session) setStatus('❌ This reset link is invalid or expired. Request a new one from the login page.');
        });
      }
    }, 1500);
    return () => { cancelled = true; sub.subscription.unsubscribe(); clearTimeout(t); };
  }, [sb]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isLoading) return;
    if (password.length < 8) return setStatus('❌ Use a password of at least 8 characters.');
    if (password !== confirm) return setStatus('❌ Passwords don’t match.');
    setIsLoading(true);
    setStatus('Updating your password…');
    try {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      const r = await finalizeBrowserSession(sb);
      setStatus('✅ Password updated. Signing you in…');
      window.location.assign(r.ok ? (r.redirect || nextPath) : '/login');
    } catch (err: any) {
      setStatus(`❌ ${err?.message || 'Could not update your password.'}`);
      setIsLoading(false);
    }
  };

  const inputCls =
    'w-full px-4 py-2 rounded-md bg-zinc-800 text-white border border-zinc-700 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <form onSubmit={submit} className="w-full max-w-md bg-zinc-900 p-8 rounded-xl shadow-lg space-y-5">
        <h1 className="text-lg font-bold text-white">Set a new password</h1>
        <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password (8+ characters)" className={inputCls} disabled={isLoading || !ready} />
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" className={inputCls} disabled={isLoading || !ready} />
        <button type="submit" disabled={isLoading || !ready} className={`w-full text-white py-2 px-4 rounded ${isLoading || !ready ? 'bg-zinc-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
          {isLoading ? 'Saving…' : ready ? 'Update password' : 'Waiting for reset link…'}
        </button>
        {status && (
          <p className={`text-sm ${status.startsWith('✅') ? 'text-green-400' : status.startsWith('❌') ? 'text-red-400' : 'text-yellow-400'}`}>{status}</p>
        )}
        <p className="text-center text-xs text-zinc-500"><SignInLink variant="inline" label="Back to sign in" /></p>
      </form>
    </div>
  );
}
