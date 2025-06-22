'use client';

import { useEffect, useState } from 'react';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { supabase } from '@/lib/supabase/client'; // ✅ use .ts file
import type { Session } from '@supabase/supabase-js';

export default function SafeSupabaseProvider({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession?: Session | null;
}) {
  const [session, setSession] = useState<Session | null | undefined>(initialSession);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {

      setSession(data.session);
      setReady(true);

      if (data.session) {
        const token = data.session.access_token;
        supabase.from('session_logs').insert({
          type: 'initial_session',
          device: navigator.userAgent,
          is_mobile: /Mobi|Android/i.test(navigator.userAgent),
          user_id: data.session.user.id,
          email: data.session.user.email,
          token_start: token?.slice(0, 4),
          token_end: token?.slice(-4),
          timestamp: new Date().toISOString(),
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      setSession(session);
      setReady(true);

      const token = session?.access_token;
      supabase.from('session_logs').insert({
        type: 'auth_change',
        event,
        device: navigator.userAgent,
        is_mobile: /Mobi|Android/i.test(navigator.userAgent),
        user_id: session?.user?.id,
        email: session?.user?.email,
        token_start: token?.slice(0, 4),
        token_end: token?.slice(-4),
        timestamp: new Date().toISOString(),
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  if (ready === false) {
    return (
      <p className="text-center text-sm text-gray-400 p-6">Initializing session…</p>
    );
  }

  return (
    <SessionContextProvider supabaseClient={supabase} initialSession={session ?? null}>
      {children}
    </SessionContextProvider>
  );
}
