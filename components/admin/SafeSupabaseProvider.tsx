// ✅ FILE: components/admin/SafeSupabaseProvider.tsx

'use client';

import { useEffect, useState } from 'react';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { supabase } from '@/lib/supabase';

export default function SafeSupabaseProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[🔁 Auth Change]', event, session);
      if (event === 'SIGNED_IN') {
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      console.log('🔍 Initial Session:', data?.session);
      setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!ready) return <p className="text-center text-sm text-gray-400 p-6">Initializing session…</p>;

  return <SessionContextProvider supabaseClient={supabase}>{children}</SessionContextProvider>;
}
