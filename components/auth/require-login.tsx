// components/auth/require-login.tsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function RequireLogin({
  children,
  fallback = null,
  redirectTo = '/login',
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setIsAuthenticated(!!session);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsAuthenticated(!!session);
    });

    return () => {
      mounted = false;
      sub.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      const next = encodeURIComponent(pathname || '/');
      router.replace(`${redirectTo}?next=${next}`);
    }
  }, [loading, isAuthenticated, pathname, redirectTo, router]);

  if (loading) return fallback;
  if (!isAuthenticated) return null;

  return <>{children}</>;
}
