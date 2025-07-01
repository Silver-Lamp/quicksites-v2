// lib/supabase/universal.ts
import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import type { Database } from '../../types/supabase';

export async function getSupabase() {
  const cookieStore = cookies();
  const headerStore = headers();

  try {
    const allCookies = (await cookieStore).getAll();
    const allHeaders = Array.from((await headerStore).entries());
    console.log('[🔐 getSupabase] 🍪 Cookies:', allCookies);
    console.log('[🔐 getSupabase] 🧠 Headers:', allHeaders);
  } catch (err) {
    console.warn('[⚠️ getSupabase] Error reading cookies/headers', err);
  }

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

  return supabase;
}
