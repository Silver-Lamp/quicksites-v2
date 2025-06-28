'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

// ✅ This client is for use in Client Components (e.g. hooks, React context)
export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,        // Stores session in localStorage
      autoRefreshToken: true,      // Auto-refresh JWT tokens when near expiry
      detectSessionInUrl: true,    // Enables OAuth flow support
    },
  }
);
