'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useCurrentUser } from '@/hooks/useCurrentUser';

type UserGateProps = {
  children: React.ReactNode;
  requireRole?: ('admin' | 'editor' | 'viewer' | 'owner')[];
  fallback?: React.ReactNode;
  redirectTo?: string;
};

export default function UserGate({
  children,
  requireRole = ['viewer', 'editor', 'admin', 'owner'],
  fallback = <p className="text-center p-6 text-muted-foreground">Authenticating…</p>,
  redirectTo = '/login',
}: UserGateProps) {
  const { user, ready } = useCurrentUser();
  const router = useRouter();

  const isAuthorized = user && requireRole.includes(user.role as 'admin' | 'editor' | 'viewer' | 'owner');

  useEffect(() => {
    if (ready && !isAuthorized) {
      router.push(redirectTo);
    }
  }, [ready, isAuthorized, redirectTo, router]);

  if (!ready) return fallback;

  return isAuthorized ? <>{children}</> : null;
}
