'use client';

import { useLoginStatus } from '@/hooks/useLoginStatus';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RequireLogin({
  children,
  fallback = null,
  redirectTo = '/login',
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}) {
  const { isAuthenticated, loading } = useLoginStatus();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace(`${redirectTo}?redirect=${window.location.pathname}`);
    }
  }, [loading, isAuthenticated]);

  if (loading) return fallback;
  if (!isAuthenticated) return null;

  return <>{children}</>;
}
