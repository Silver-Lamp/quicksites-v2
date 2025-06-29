'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import ReCAPTCHA from 'react-google-recaptcha';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recaptchaRef = useRef<ReCAPTCHA | null>(null);

  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [debug, setDebug] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!user || error) {
        setLoading(false);
        setDebug({ user: null, error });
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, plan')
        .eq('user_id', user.id)
        .maybeSingle();

      const role = profile?.role ?? 'viewer';
      const plan = profile?.plan ?? 'free';

      setDebug({ user, profile, role, plan });

      if (role !== 'viewer') {
        const redirect =
          plan === 'enterprise'
            ? '/enterprise/dashboard'
            : ['admin', 'owner', 'reseller'].includes(role)
              ? '/admin/dashboard?message=welcome'
              : '/?message=welcome';
        router.replace(redirect);
      } else {
        setShowOnboarding(true);
      }

      setLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const devEmail = searchParams?.get('dev-login');
    if (!devEmail?.includes('@')) return;

    supabase.auth
      .signInWithOtp({
        email: devEmail,
        options: { emailRedirectTo: `${window.location.origin}/login` },
      })
      .then(({ error }) =>
        error
          ? console.error('[❌ Dev AutoLogin Error]', error.message)
          : console.log('[✅ Dev Magic Link Sent]')
      );
  }, [searchParams]);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        router.replace('/login');
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  const handleLogin = async () => {
    const token = await recaptchaRef.current?.executeAsync();
    recaptchaRef.current?.reset();

    if (!token) {
      setMessage('❌ reCAPTCHA failed. Try again.');
      return;
    }

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, recaptchaToken: token }),
    });

    const data = await res.json();
    setMessage(res.ok ? '✅ Check your email for the magic link.' : `❌ ${data.error || 'Login failed.'}`);
  };

  const assignRole = async (selected: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id || !user?.email) return;

    const now = new Date().toISOString();

    await supabase.from('user_profiles').upsert({
      user_id: user.id,
      email: user.email,
      role: selected,
      last_seen_at: now,
    });

    await supabase.from('session_logs').insert({
      type: 'assign_role',
      user_id: user.id,
      email: user.email,
      role: selected,
      timestamp: now,
    });

    setToast(`✅ Role set to "${selected}"`);
    setShowOnboarding(false);
    setTimeout(() => setToast(null), 3000);

    router.replace(selected === 'admin' ? '/admin/dashboard' : '/?message=role-assigned');
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      {loading ? (
        <div className="flex flex-col items-center gap-3 text-sm text-muted">
          <div className="w-6 h-6 border-4 border-indigo-600 border-t-transparent animate-spin rounded-full" />
          Checking session…
        </div>
      ) : (
        <div className="w-full max-w-md bg-zinc-900 p-8 rounded-xl shadow-lg space-y-6">
          <h1 className="text-2xl font-extrabold text-center">Login</h1>

          {toast && <div className="text-sm text-yellow-400 text-center">{toast}</div>}

          {showOnboarding ? (
            <div className="text-sm space-y-4 text-center">
              <p>👋 Welcome! Choose your role to begin:</p>
              <div className="flex flex-col gap-2">
                {['viewer', 'reseller'].map((r) => (
                  <button
                    key={r}
                    onClick={() => assignRole(r)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-md transition"
                  >
                    Continue as {r}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <label htmlFor="email" className="sr-only">Email address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLogin();
                  }
                }}
                placeholder="you@example.com"
                className="w-full px-4 py-2 rounded-md bg-zinc-800 text-white border border-zinc-700 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleLogin}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-md font-medium transition"
              >
                Send Magic Link
              </button>
              {message && (
                <p
                  className={`text-sm text-center ${
                    message.startsWith('✅') ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {message}
                </p>
              )}
              {process.env.NODE_ENV === 'development' && debug && (
                <details className="mt-4 space-y-3">
                  <summary className="cursor-pointer text-sm text-zinc-500">Debug Info</summary>
                  <pre className="text-xs bg-zinc-800 text-zinc-300 rounded p-2 overflow-auto max-h-64">
                    {JSON.stringify(debug, null, 2)}
                  </pre>
                  <button
                    onClick={async () => {
                      await fetch('/api/logout', { method: 'POST' });
                      router.replace('/login?logout=1');
                      setTimeout(() => window.location.reload(), 300);
                    }}
                    className="w-full bg-red-700 hover:bg-red-800 text-white py-2 text-sm rounded transition"
                  >
                    Log Out
                  </button>
                </details>
              )}
              <ReCAPTCHA
                sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}
                size="invisible"
                ref={recaptchaRef}
              />
            </>
          )}
        </div>
      )}
    </main>
  );
}
