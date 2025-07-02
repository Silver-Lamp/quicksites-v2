'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const hash = window.location.hash; // includes `#access_token=...`
      const url = `${window.location.origin}/auth/callback${hash}`;

      const { error } = await supabase.auth.exchangeCodeForSession(url);

      if (error) {
        console.error('[❌ Exchange Failed]', error);
        router.push('/login?error=exchange_failed');
      } else {
        router.push('/');
      }
    };

    run();
  }, []);

  return <p className="p-4 text-white">Logging you in...</p>;
}
