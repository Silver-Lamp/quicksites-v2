'use client';

import { useState, useEffect } from 'react';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';

// ✅ Read env variables at module level
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [supabaseClient, setSupabaseClient] = useState<any>(null);

  useEffect(() => {
    const client = createPagesBrowserClient({
      supabaseUrl,
      supabaseKey,
    });
    setSupabaseClient(client);
  }, []);

  if (!supabaseClient) return null;

  return (
    <SessionContextProvider supabaseClient={supabaseClient}>
      {children}
    </SessionContextProvider>
  );
}
