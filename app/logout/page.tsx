'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/admin/lib/supabaseClient';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        await supabase.auth.signOut();

        // ✅ clear any cached client state if needed
        router.replace('/login?logout=1');
        router.refresh();

        // optional: force reload to flush any stale UI
        setTimeout(() => window.location.reload(), 200);
      } catch (err) {
        console.error('Error during logout', err);
        router.replace('/login?logout=1&error=1');
      }
    })();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-foreground">
      <p>Logging you out…</p>
    </div>
  );
}
