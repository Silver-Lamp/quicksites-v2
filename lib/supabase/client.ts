'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase'; // Adjust path if needed

// ✅ Browser-side Supabase client — for use in Client Components only
export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,       // Saves session in localStorage
      autoRefreshToken: true,     // Refresh JWT automatically
      detectSessionInUrl: true,   // Handles OAuth callbacks
    },
  }
);
