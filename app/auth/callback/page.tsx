'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function AuthCallbackPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const exchangeCode = async () => {
      const redirect = searchParams?.get('redirect') || '/admin/dashboard';

      const { error } = await supabase.auth.getSession(); // Triggers cookie set + client-side session

      if (error) {
        console.error('[auth/callback] Session error:', error.message);
        router.replace('/login?error=session');
        return;
      }

      // ✅ Supabase should now be fully initialized
      router.replace(redirect);
    };

    exchangeCode().finally(() => setLoading(false));
  }, [router, searchParams, supabase]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-sm text-zinc-400">
      {loading ? (
        <>
          <div className="animate-pulse">Verifying login link...</div>
        </>
      ) : (
        <div className="text-red-500">Login failed. Please try again.</div>
      )}
    </div>
  );
}
