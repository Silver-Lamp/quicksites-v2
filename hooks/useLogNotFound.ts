// ✅ FILE: hooks/useLogNotFound.ts

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useLogNotFound(context: 'public' | 'admin') {
  useEffect(() => {
    const path = window.location.pathname + window.location.search;
    const referrer = document.referrer || null;
    const user_agent = navigator.userAgent;

    fetch('/api/ip')
      .then((res) => res.json())
      .then(({ ip }) => {
        supabase.from('not_found_logs')
          .insert({
            path,
            context,
            referrer,
            user_agent,
            ip,
            timestamp: new Date().toISOString(),
          })
          .catch(console.error);
      })
      .catch(console.error);
  }, [context]);
}
