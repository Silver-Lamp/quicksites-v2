'use server';

import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

/**
 * Returns a Supabase client that reads cookies from the current request context.
 * Should only be used in Server Components or Server Actions.
 */
export async function createScopedSupabaseClient(): Promise<SupabaseClient<Database>> {
  const { cookies } = await import('next/headers');
  const cookieStore = cookies(); // ✅ now sync in Next 13.5+

  return createServerClient<Database>(
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
}
