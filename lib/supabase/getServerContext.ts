'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Headers as ServerHeaders } from 'next/dist/compiled/@edge-runtime/primitives';
import type { Database } from '@/types/supabase';

import { createServerClient } from '@supabase/ssr';


/**
 * Safely returns request-scoped Supabase client, headers, and cookies.
 * Use only in server components, route handlers, or middleware.
 */
export async function getServerContext(): Promise<{
  supabase: SupabaseClient<Database>;
  cookies: ReturnType<Awaited<typeof import('next/headers')>['cookies']>;
  headers: ServerHeaders;
}> {
  const { cookies, headers } = await import('next/headers');

  const cookieStore = cookies();
  const headerStore = headers();

  const supabase = createServerClient<Database>({
    cookies: async () => cookieStore,
  });

  return {
    supabase,
    cookies: cookieStore,
    headers: headerStore,
  };
}
