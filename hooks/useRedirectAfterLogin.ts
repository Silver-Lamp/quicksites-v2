// hooks/useRedirectAfterLogin.ts
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCurrentUser } from './useCurrentUser';

export function useRedirectAfterLogin() {
  const router = useRouter();
  const sp = useSearchParams();
  const { user, ready } = useCurrentUser();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const toasted = useRef(false);

  const dest = useMemo(() => {
    const n = sp.get('next') || sp.get('redirectTo') || '/admin/tools';
    return n.startsWith('/') ? n : '/admin/tools';
  }, [sp]);

  useEffect(() => {
    if (!ready) return;
    if (!user) return;

    (async () => {
      if (!toasted.current) {
        toasted.current = true;
        try {
          const { toast } = await import('react-hot-toast');
          toast.success('✅ Logged in! Redirecting...', {
            duration: 2000,
            style: { background: '#1e1e1e', color: '#fff' },
          });
        } catch {}
      }
      setIsRedirecting(true);
      router.replace(dest);
    })();
  }, [user, ready, dest, router]);

  return { redirectTo: dest, isRedirecting };
}
