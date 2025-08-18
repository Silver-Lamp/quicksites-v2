// app/auth/callback/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function AuthCallback() {
  const router = useRouter();
  const qp = useSearchParams();
  const [msg, setMsg] = useState('Finishing sign-in…');

  useEffect(() => {
    (async () => {
      const code = qp.get('code');
      if (!code) { setMsg('Missing authorization code.'); return; }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error('[Exchange Failed]', error);
        setMsg(`Sign-in failed: ${error.message}`);
        return;
      }
      setMsg('Signed in! Redirecting…');
      router.replace('/admin/tools');
    })();
  }, [qp, router]);

  return (
    <div className="min-h-screen grid place-items-center">
      <p className="text-sm text-muted-foreground">{msg}</p>
    </div>
  );
}
