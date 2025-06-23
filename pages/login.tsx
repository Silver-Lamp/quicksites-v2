'use client';

import { useSetSessionFromHash } from '@/hooks/useSetSessionFromHash';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import ReCAPTCHA from 'react-google-recaptcha';

export default function LoginPage() {
  useSetSessionFromHash();
  const recaptchaRef = useRef<any>(null);

  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      const session = sessionData.session;
      const id = session?.user?.id;
      const email = session?.user?.email ?? null;

      if (session && id && email) {
        const now = new Date().toISOString();

        await supabase.from('user_profiles').upsert({
          user_id: id,
          email,
          last_seen_at: now,
        });

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role, plan')
          .eq('user_id', id)
          .maybeSingle();

        const role = profile?.role ?? null;
        const plan = profile?.plan ?? 'free';

        if (role) {
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
      }

      setLoading(false);
    });
  }, []);

  const handleLogin = async () => {
    const token = await recaptchaRef.current.executeAsync();
    recaptchaRef.current.reset();

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

    if (!res.ok) {
      setMessage(`❌ ${data.error || 'Login failed.'}`);
    } else {
      setMessage('✅ Check your email for the magic link.');
    }
  };

  const assignRole = async (selected: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const id = session?.user?.id;
    const email = session?.user?.email ?? '';

    if (!id || !email) return;

    const now = new Date().toISOString();

    await supabase.from('user_profiles').upsert({
      user_id: id,
      email,
      role: selected,
      last_seen_at: now,
    });

    await supabase.from('session_logs').insert({
      type: 'assign_role',
      user_id: id,
      email,
      role: selected,
      timestamp: now,
    });

    setShowOnboarding(false);
    setToast(`✅ Role set to "${selected}"`);
    setTimeout(() => setToast(null), 3000);

    const redirect = selected === 'admin' ? '/admin/dashboard' : '/?message=role-assigned';

    router.replace(redirect);
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white p-4 relative">
      {loading && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
          <svg
            className="animate-spin h-8 w-8 text-white mb-3"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          <p className="text-sm text-gray-300">Checking session…</p>
        </div>
      )}

      <div className="bg-zinc-900 p-6 rounded shadow max-w-sm w-full">
        <h1 className="text-xl font-bold mb-4 text-center">Login</h1>

        {showOnboarding ? (
          <div className="text-sm text-center space-y-4">
            <p>👋 Welcome! Choose your starting role:</p>
            <div className="flex flex-col gap-2">
              {['viewer', 'reseller'].map((r) => (
                <button
                  key={r}
                  onClick={() => assignRole(r)}
                  className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded"
                >
                  Continue as {r}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {toast && <p className="text-center mb-4 text-yellow-400 text-sm">{toast}</p>}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 mb-4 rounded bg-zinc-800 border border-zinc-700 text-white"
            />
            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-sm font-semibold"
            >
              Send Magic Link
            </button>
            {message && (
              <p
                className={`mt-4 text-sm text-center ${message.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}
              >
                {message}
              </p>
            )}
            <ReCAPTCHA
              sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}
              size="invisible"
              ref={recaptchaRef}
            />
          </>
        )}
      </div>
    </div>
  );
}
