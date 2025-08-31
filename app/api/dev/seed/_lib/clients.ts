import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { OPENAI_API_KEY, SERVICE_ROLE, SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

export type AnyClient = SupabaseClient<any, any, any>;

export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function getCookieBoundClient() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieEncoding: 'base64url',
    cookies: {
      getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
      setAll: (cks) => cks.forEach((c) => store.set(c.name, c.value, c.options as CookieOptions | undefined)),
    },
  }) as AnyClient;
}

export const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
