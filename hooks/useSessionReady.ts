// ✅ FILE: /hooks/useSessionReady.ts

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient.js';

export function useSessionReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setReady(true);
    });

    supabase.auth.getSession().then(() => {
      setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  return ready;
}
