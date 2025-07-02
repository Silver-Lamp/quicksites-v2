'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const hash = window.location.hash;
      const fullUrl = `${window.location.origin}/auth/callback${hash}`;

      if (!hash.includes('access_token') && process.env.NODE_ENV !== 'development') {
        console.warn('[⚠️ Missing access_token in hash]');
        router.replace('/login?error=missing_token');
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(fullUrl);

      if (error) {
        console.error('[❌ Exchange Failed]', error);
        router.replace('/login?error=exchange_failed');
      } else {
        router.replace('/admin/dashboard');
      }
    };

    run();
  }, [router]);

  return (
    <div className="p-4 text-white">
      Logging you in...
    </div>
  );
}
