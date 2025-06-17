// ✅ FILE: pages/login.tsx

'use client';

import { useSetSessionFromHash } from '@/hooks/useSetSessionFromHash';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { useRouter } from 'next/router';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function LoginPage() {
  useSetSessionFromHash();
  // const { isLoading, roleSource, role, allowAdminPromotion } = useCurrentUser();

  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      let session = sessionData.session;

      if (!session) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          session = { user: userData.user } as any;
        }
      }

      const id = session?.user?.id;
      const email = session?.user?.email ?? null;

      if (session && id && email) {
        const now = new Date().toISOString();
        await supabase.from('user_profiles').upsert({
          user_id: id,
          last_seen_at: now,
        });

        const { data: roleRow } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_email', email)
          .maybeSingle();

        const role = roleRow?.role ?? null;

        if (role) {
          if (['admin', 'owner', 'reseller'].includes(role)) {
            router.replace('/admin/dashboard?message=welcome');
          } else {
            router.replace('/?message=welcome');
          }
        } else {
          await supabase.from('user_profiles').upsert({
            user_id: id,
            first_seen_at: now,
          });
          setShowOnboarding(true);
        }
      }
      setLoading(false);
    });
  }, []);

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: 'http://localhost:3000/',
      },
    });
    if (error) {
      setMessage(`❌ ${error.message}`);
    } else {
      setMessage('✅ Check your email for the magic link.');
    }
  };

  const assignRole = async (selected: string) => {
    await supabase.auth.updateUser({ data: { role: selected } });
    await supabase.from('user_roles').insert({
      user_email: email,
      new_role: selected,
      updated_at: new Date().toISOString(),
    });
    setShowOnboarding(false);
    setToast(`✅ Role set to "${selected}"`);
    setTimeout(() => setToast(null), 3000);
    router.replace(`/?message=role-assigned-${selected}`);
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white p-4 relative">
      {loading && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex flex-col items-center justify-center">
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
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            ></path>
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
            {/* {allowAdminPromotion && (
              <div className="mt-4">
                <button
                  onClick={() => assignRole('admin')}
                  className="text-xs text-yellow-400 hover:underline"
                >
                  🔧 Promote me to admin
                </button>
              </div>
            )} */}
          </div>
        ) : (
          <>
            {flash && (
              <p className="text-center mb-4 text-green-400 text-sm">{flash}</p>
            )}
            {toast && (
              <p className="text-center mb-4 text-yellow-400 text-sm">
                {toast}
              </p>
            )}
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
                className={`mt-4 text-sm text-center ${
                  message.startsWith('✅') ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {message}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
