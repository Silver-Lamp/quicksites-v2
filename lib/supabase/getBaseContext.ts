// lib/supabase/getBaseContext.ts
'use server';

import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';

export type BaseContext = {
  supabase: SupabaseClient<Database>;
  cookies: ReturnType<typeof cookies>;
  headers: ReturnType<typeof headers>;
  ip: string;
  userAgent: string;
};

export async function getBaseContext(): Promise<BaseContext> {
  const cookieStore = cookies();
  const headerStore = headers();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          const cookie = await cookieStore;
          return cookie.get(name)?.value;
        },
      },
    }
  );

  const ip =
    (await headerStore).get('x-forwarded-for')?.split(',')[0]?.trim() ||
    (await headerStore).get('x-real-ip') ||
    'unknown';

  const userAgent = (await headerStore).get('user-agent') || 'unknown';

  return {
    supabase,
    cookies: cookieStore,
    headers: headerStore,
    ip,
    userAgent,
  };
}
