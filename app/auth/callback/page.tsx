'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
      if (error) {
        console.error('[❌ Exchange Failed]', error);
      } else {
        router.push('/'); // or your desired redirect
      }
    };
    run();
  }, []);

  return <p className="p-4 text-white">Logging you in...</p>;
}
