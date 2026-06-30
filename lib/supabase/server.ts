// lib/supabase/server.ts
import { cookies as nextCookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';
import { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } from '@/lib/env';

export async function getServerSupabase( { serviceRole = false }: { serviceRole?: boolean } = {} ) {
  const store = await nextCookies();
  return createServerClient<Database>(
    supabaseUrl(),
    serviceRole ? supabaseServiceRoleKey() : supabaseAnonKey(),
    {
      cookies: {
        getAll: () => store.getAll(),   // never JSON.parse
        setAll: () => {},               // RSC can’t set; noop
      },
      cookieEncoding: 'base64url',
    }
  );
}
