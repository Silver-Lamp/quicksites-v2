import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const isPlaywright = process.env.NEXT_PUBLIC_IS_PLAYWRIGHT_TEST === 'true';
  
    if (isPlaywright) {
      router.push('/dashboard');
      return;
    }
  
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    });
  }, []);

  return <p>Redirecting...</p>;
}
