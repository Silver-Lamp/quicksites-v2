// app/admin/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/admin/lib/supabaseClient';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const isPlaywright = process.env.NEXT_PUBLIC_IS_PLAYWRIGHT_TEST === 'true';

    if (isPlaywright) {
      console.log('🔄 [Admin] [Index] Redirecting to dashboard', {
        isPlaywright,
      });
      router.push('/admin/dashboard');
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        console.log('🔄 [Admin] [Index] Redirecting to dashboard', { data });
        router.push('/admin/dashboard');
      } else {
        console.log('🔄 [Admin] [Index] Redirecting to login', { data });
        router.push('/login');
      }
    });
  }, []);

  return <p>Redirecting...</p>;
}
