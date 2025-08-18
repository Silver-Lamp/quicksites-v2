// admin/lib/withAuth.tsx
'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';

type WhoAmI = { userPresent?: boolean; isAdmin?: boolean };

export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  opts: { requireAdmin?: boolean } = { requireAdmin: true }
) {
  const Guard: React.FC<P> = (props) => {
    const router = useRouter();
    const pathname = usePathname();
    const [loading, setLoading] = React.useState(true);
    const [allowed, setAllowed] = React.useState(false);

    React.useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const res = await fetch('/api/auth/whoami', {
            credentials: 'include',
            cache: 'no-store',
          });
          const data: WhoAmI = await res.json().catch(() => ({} as WhoAmI));
          const ok = !!data.userPresent && (!opts.requireAdmin || !!data.isAdmin);
          if (!cancelled) {
            setAllowed(ok);
            setLoading(false);
            if (!ok) router.replace(`/login?next=${encodeURIComponent(pathname ?? '/')}`);
          }
        } catch {
          if (!cancelled) {
            setLoading(false);
            router.replace(`/login?next=${encodeURIComponent(pathname ?? '/')}`);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [pathname, router]);

    if (loading) return <div className="p-6 text-sm text-muted-foreground">Checking your session…(withAuth(</div>;
    if (!allowed) return null; // redirected
    return <Component {...(props as P)} />;
  };

  Guard.displayName = `withAuth(${Component.displayName || Component.name || 'Component'})`;
  return Guard;
}
