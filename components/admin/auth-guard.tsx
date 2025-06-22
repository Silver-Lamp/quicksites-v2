'use client';

import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSession } from '@supabase/auth-helpers-react'; // ✅ Import session hook

export default function AuthGuard({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const router = useRouter();
  const { user, role, isLoading, roleSource } = useCurrentUser();
  const session = useSession(); // ✅ Get current session
  const [hydrated, setHydrated] = useState(false);
  const [readyToCheck, setReadyToCheck] = useState(false);

  const skipRoleCheck = true;

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !isLoading && user && role) {
      setReadyToCheck(true);
    }
  }, [hydrated, isLoading, user, role]);

  useEffect(() => {
    if (skipRoleCheck || !readyToCheck) return;

    const normalizedRole = role ? role.toLowerCase().trim() : '';
    const allowed = roles?.map((r) => r.toLowerCase()).includes(normalizedRole) ?? true;

    // const maskedToken = session?.access_token
    // ? `${session.access_token.slice(0, 4)}...${session.access_token.slice(-4)}`
    // : 'none';
    const maskedToken = 'session-derived'; // or just omit this for now


    console.debug('[🔒 AuthGuard check]', {
      user: user?.email ?? null,
      role,
      normalizedRole,
      roles,
      allowed,
      isLoading,
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
  }, [readyToCheck, user, role, roles, router, roleSource, isLoading, session, skipRoleCheck]);

  if (skipRoleCheck || (!readyToCheck || !role)) {
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
