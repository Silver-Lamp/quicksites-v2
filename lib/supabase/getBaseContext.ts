'use server';

import { cookies, headers } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase';

export type BaseContext = {
  supabase: ReturnType<typeof createServerComponentClient<Database>>;
  cookies: ReturnType<typeof cookies>;
  headers: ReturnType<typeof headers>;
  ip: string;
  userAgent: string;
};

export function getBaseContext(): BaseContext {
  const cookieStore = cookies(); // ✅ sync-safe in App Router
  const headerStore = headers();

  const supabase = createServerComponentClient<Database>({
    cookies: () => Promise.resolve(cookieStore), // ✅ fixes Supabase integration
    headers: () => headerStore,
  });

  const ip =
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headerStore.get('x-real-ip') ||
    'unknown';

  const userAgent = headerStore.get('user-agent') || 'unknown';

  return {
    supabase,
    cookies: cookieStore,
    headers: headerStore,
    ip,
    userAgent,
  };
}
