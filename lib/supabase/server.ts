// lib/supabase/server.ts
import { cookies as nextCookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

export async function getServerSupabase() {
  const store = await nextCookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),   // never JSON.parse
        setAll: () => {},               // RSC can’t set; noop
      },
      cookieEncoding: 'base64url',
    }
  );
}
