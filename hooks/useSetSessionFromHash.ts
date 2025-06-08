// ✅ FILE: hooks/useSetSessionFromHash.ts

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useSetSessionFromHash() {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);

    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (access_token && refresh_token) {
      console.log('🔑 Attempting to set session from URL fragment...');
      supabase.auth
        .setSession({ access_token, refresh_token })
        .then(({ data, error }) => {
          console.log('[🔐 setSession result]', { data, error });
          if (!error) {
            window.location.replace('/');
          }
        });
    }
  }, []);
}
