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
        // Service-role clients must NOT carry the user's session: @supabase/ssr would
        // restore it from the cookie and send the user's JWT as the Authorization
        // bearer, which overrides the service_role key at PostgREST — so requests run
        // as the authenticated user and RLS applies (silently breaking service-role
        // writes for any logged-in caller). Presenting no cookies keeps the
        // service_role key as the bearer → RLS bypassed, as intended. Auth is always
        // read from a separate (non-service) client, so this never affects getUser().
        getAll: () => (serviceRole ? [] : store.getAll()), // never JSON.parse
        setAll: () => {},               // RSC can’t set; noop
      },
      cookieEncoding: 'base64url',
    }
  );
}
