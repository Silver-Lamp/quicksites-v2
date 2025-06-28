'use server';

import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// ⚠️ Avoid repeated instantiation across server contexts
let cachedClient: SupabaseClient<Database> | null = null;

export async function createScopedSupabaseClient(): Promise<SupabaseClient<Database>> {
  if (cachedClient) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[⚠️ Supabase Server Client] Duplicate instantiation detected');
    }

    return cachedClient;
  }

  const { cookies } = await import('next/headers');
  const cookieStore = cookies(); // ✅ sync in App Router

  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          return (await cookieStore).get(name)?.value;
        },
      },
    }
  );

  cachedClient = client;
  return client;
}
