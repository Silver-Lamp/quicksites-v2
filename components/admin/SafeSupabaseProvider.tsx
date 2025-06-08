// ✅ FILE: /components/admin/SafeSupabaseProvider.tsx

'use client';

import { useEffect, useState } from 'react';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { supabase } from '@/lib/supabase';

export default function SafeSupabaseProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
      setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!ready) return <p className="text-center text-sm text-gray-400 p-4">Initializing session…</p>;

  return (
    <SessionContextProvider supabaseClient={supabase}>
      {showToast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded shadow">
          👋 Welcome back!
        </div>
      )}
      {children}
    </SessionContextProvider>
  );
}
