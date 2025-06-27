'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/admin/lib/supabaseClient';

type RoleMap = Partial<Record<string, string>>;

type Options = {
  roleRoutes?: RoleMap;
  fallbackRoute?: string;
  enableTestBypass?: boolean;
};

/**
 * Redirects the user based on their Supabase `user_profiles.role`.
 * Customize the `roleRoutes` map to control where each role should go.
 */
export function useAutoRedirectByRole({
  roleRoutes = {
    admin: '/admin/dashboard',
    owner: '/admin/dashboard',
    reseller: '/admin/dashboard',
    viewer: '/viewer',
  },
  fallbackRoute = '/unauthorized',
  enableTestBypass = false,
}: Options = {}) {
  const router = useRouter();

  useEffect(() => {
    const isTestMode = enableTestBypass && process.env.NEXT_PUBLIC_IS_PLAYWRIGHT_TEST === 'true';

    if (isTestMode) {
      router.replace(roleRoutes.admin || '/admin/dashboard');
      return;
    }

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user?.id) {
        router.replace('/login');
        return;
      }

      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      const role = profile?.role ?? 'viewer';
      const redirectTo = roleRoutes[role] || fallbackRoute;

      console.log(`[🔁 AutoRedirect] Role "${role}" → ${redirectTo}`);
      router.replace(redirectTo);
    });
  }, [router, roleRoutes, fallbackRoute, enableTestBypass]);
}
