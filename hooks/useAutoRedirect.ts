'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/admin/lib/supabaseClient';

type UseAutoRedirectOptions = {
  ifLoggedIn: string;
  ifLoggedOut?: string;
  enableTestBypass?: boolean;
};

/**
 * Redirects the user based on auth session.
 * - `ifLoggedIn`: path to redirect when session exists
 * - `ifLoggedOut`: optional path to redirect when no session
 * - `enableTestBypass`: forces test mode routing via env flag
 */
export function useAutoRedirect({
  ifLoggedIn,
  ifLoggedOut,
  enableTestBypass = false,
}: UseAutoRedirectOptions) {
  const router = useRouter();

  useEffect(() => {
    const isTestMode = enableTestBypass && process.env.NEXT_PUBLIC_IS_PLAYWRIGHT_TEST === 'true';

    if (isTestMode) {
      console.log('🔁 [Redirect] Test mode enabled — sending to', ifLoggedIn);
      router.replace(ifLoggedIn);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        console.log('🔐 [Redirect] User is logged in —', data.session.user.email);
        router.replace(ifLoggedIn);
      } else if (ifLoggedOut) {
        console.log('🔓 [Redirect] No session — redirecting to', ifLoggedOut);
        router.replace(ifLoggedOut);
      }
    });
  }, [router, ifLoggedIn, ifLoggedOut, enableTestBypass]);
}
