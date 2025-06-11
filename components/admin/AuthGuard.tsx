'use client';

import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function AuthGuard({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const router = useRouter();
  const { user, role, loading, roleSource } = useCurrentUser();
  const [hydrated, setHydrated] = useState(false);
  const [readyToCheck, setReadyToCheck] = useState(false);
  console.log('🔒 [AuthGuard] Loading', { user, role, loading, roles, roleSource, readyToCheck, hydrated });

  const skipRoleCheck = true;
  if (skipRoleCheck) {
    console.log('🔒 [AuthGuard] Skipping role check', { user, role });
    return <>{children}</>;
  }

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !loading && user && role) {
      setReadyToCheck(true);
    }
  }, [hydrated, loading, user, role]);

  useEffect(() => {
    if (!readyToCheck) return;

    const normalizedRole = role?.toLowerCase().trim();
    const allowed =
      roles?.map((r) => r.toLowerCase()).includes(normalizedRole) ?? true;

    const maskedToken = user?.access_token
      ? `${user.access_token.slice(0, 4)}...${user.access_token.slice(-4)}`
      : 'none';

    console.debug('[🔒 AuthGuard check]', {
      user: user?.email ?? null,
      role,
      normalizedRole,
      roles,
      allowed,
      loading,
      roleSource,
      readyToCheck,
      token: maskedToken,
    });

    if (!user || !allowed) {
      console.warn('[🚫 Access Denied]', {
        email: user?.email ?? 'none',
        role,
        source: roleSource,
        expected: roles,
      });
      router.replace(`/login?error=unauthorized`);
    }
  }, [readyToCheck, user, role, roles, router, roleSource]);

  if (!readyToCheck || !role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="text-sm text-gray-400">Checking permissions…</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
