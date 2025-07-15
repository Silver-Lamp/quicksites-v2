// lib/supabase/client.ts
'use client';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: {
    autoRefreshToken: true,
    storageKey: 'sb-auth-token',
    persistSession: true,
    detectSessionInUrl: true,
    // storage: 'cookie',
  },
  global: {
    fetch: fetch,
  },
});

