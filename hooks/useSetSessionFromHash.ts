// hooks/useSetSessionFromHash.ts
'use client';

import { useEffect } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export function useSetSessionFromHash() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;

    if (!hash) return;

    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) return;

    console.log('[🔐 Extracted tokens from hash]', { accessToken, refreshToken });

    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          console.error('[❌ Failed to set session]', error);
        } else {
          console.log('[✅ Supabase session restored]');
          router.replace('/'); // 🔄 Clean up the hash from URL
        }
      });
  }, []);
}
