// lib/supabase/serverClient.ts
import 'server-only';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** RSC-safe (pages/layouts) */
export async function getSupabaseRSC() {
  const store = await cookies();
  return createServerClient<Database>(URL, ANON, {
    cookieEncoding: 'base64url',
    cookies: {
      getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
      setAll: () => {}, // NO-OP in RSC
    },
  });
}

/** Server Actions / route handlers */
export async function getSupabaseForAction() {
  const store = await cookies();
  return createServerClient<Database>(URL, ANON, {
    cookieEncoding: 'base64url',
    cookies: {
      getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
      setAll(cs) {
        for (const { name, value, options } of cs) {
          store.set({ name, value, ...(options as CookieOptions | undefined) });
        }
      },
    },
  });
}

/** Back-compat alias while migrating imports */
export const getServerSupabaseClient = getSupabaseRSC;
