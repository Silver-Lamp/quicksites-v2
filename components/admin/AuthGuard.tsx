// ✅ FILE: components/admin/AuthGuard.tsx

'use client';

import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function AuthGuard({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const router = useRouter();
  const { user, role, loading } = useCurrentUser();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!loading && hydrated) {
      if (!user || (roles && !roles.includes(role))) {
        router.replace(`/login?error=unauthorized`);
      }
    }
  }, [user, role, roles, router, loading, hydrated]);

  if (!hydrated || loading || !user || (roles && !roles.includes(role))) {
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
