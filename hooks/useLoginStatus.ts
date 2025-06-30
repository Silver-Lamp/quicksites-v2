// hooks/useLoginStatus.ts
'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Session } from '@supabase/supabase-js';

export function useLoginStatus() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!error) setSession(data.session);
      setLoading(false);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((_, newSession) => {
      setSession(newSession);
    });

    fetch();

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [supabase]);

  return {
    isAuthenticated: !!session,
    session,
    loading,
    user: session?.user ?? null,
  };
}
