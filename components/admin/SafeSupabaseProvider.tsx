// ✅ FILE: components/admin/SafeSupabaseProvider.tsx

'use client';

import { useEffect, useState } from 'react';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { supabase } from '@/lib/supabaseClient.js';

export default function SafeSupabaseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const shortToken = session?.access_token
        ? `${session.access_token.slice(0, 4)}...${session.access_token.slice(-4)}`
        : 'none';

      await supabase.from('session_logs').insert({
        type: 'auth_change',
        device: navigator.userAgent,
        is_mobile: /Mobi|Android/i.test(navigator.userAgent),
        user_id: session?.user?.id,
        event,
        email: session?.user?.email,
        token_start: session?.access_token?.slice(0, 4),
        token_end: session?.access_token?.slice(-4),
        timestamp: new Date().toISOString(),
      });

      if (event === 'SIGNED_IN') {
        setReady(true);
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      const token = data?.session?.access_token;
      const masked = token
        ? `${token.slice(0, 4)}...${token.slice(-4)}`
        : 'none';
      await supabase.from('session_logs').insert({
        type: 'initial_session',
        device: navigator.userAgent,
        user_id: data?.session?.user?.id,
        email: data?.session?.user?.email,
        token_start: token?.slice(0, 4),
        token_end: token?.slice(-4),
        timestamp: new Date().toISOString(),
      });
      setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!ready)
    return (
      <p className="text-center text-sm text-gray-400 p-6">
        Initializing session…
      </p>
    );

  return (
    <SessionContextProvider supabaseClient={supabase}>
      {children}
    </SessionContextProvider>
  );
}
