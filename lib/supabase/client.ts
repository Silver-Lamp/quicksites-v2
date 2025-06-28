'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

// Singleton cache to avoid multiple instantiations
let browserSupabaseClient:
  | ReturnType<typeof createBrowserClient<Database>>
  | null = null;

// Optional: Set this flag during debugging to see where second inits come from
const DEBUG_SUPABASE_CLIENT = false;

if (browserSupabaseClient) {
  if (DEBUG_SUPABASE_CLIENT) {
    console.error('[❌ SupabaseClient] Already instantiated');
    console.trace(); // Optional: print call stack
  }
  throw new Error('[❌ SupabaseClient] Multiple browser Supabase clients detected');
}

browserSupabaseClient = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export const supabase = browserSupabaseClient;
