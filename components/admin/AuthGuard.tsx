import { useRouter } from 'next/router';
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { useCurrentUser } from '@/admin/hooks/useCurrentUser';

export default function AuthGuard({
  children,
  roles: allowedRoles,
  redirect = '/unauthorized'
}: {
  children: React.ReactNode;
  roles?: string[];
  redirect?: string;
}) {
  const { session, role } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!session || (allowedRoles && !allowedRoles.includes(role))) {
      console.warn('Access denied for user role:', role, 'Route:', router.pathname);
      const alertThrottleKey = `denied:${session?.user?.id || 'anon'}:${router.pathname}`;
      const lastAlert = sessionStorage.getItem(alertThrottleKey);
      const now = Date.now();
      if (!lastAlert || now - parseInt(lastAlert) > 30000) {
        sessionStorage.setItem(alertThrottleKey, now.toString());

        Sentry.captureEvent({
        level: 'error',
        message: 'Access denied',
        tags: {
          role: role || 'unknown',
          route: router.pathname
        },
        extra: {
          user_agent: typeof window !== 'undefined' ? navigator.userAgent : 'unknown',
          email: session?.user?.email || 'unknown',
          user_id: session?.user?.id || 'n/a',
          timestamp: new Date().toISOString()
        }
      });
    }
    if (!session || (allowedRoles && !allowedRoles.includes(role))) {
      router.push(redirect); // or '/login' if preferred
    }
  }, [session, router, allowedRoles, role]);

  if (!session || (allowedRoles && !allowedRoles.includes(role))) {
    return null;
  }

  return <>{children}</>;
}
