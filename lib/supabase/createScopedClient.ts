'use server';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';


let cachedClient: SupabaseClient<Database> | null = null;

export async function createScopedSupabaseClient(): Promise<SupabaseClient<Database>> {
  type SimpleCookieStore = {
    get(name: string): { name: string; value: string } | undefined;
  };
  if (cachedClient) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[⚠️ Supabase Server Client] Duplicate instantiation detected');
    }
    return cachedClient;
  }

  const cookieStore = cookies() as unknown as SimpleCookieStore;

  
  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  cachedClient = client;
  return client;
}
