import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies, headers } from 'next/headers';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import type { ReadonlyHeaders } from 'next/dist/server/web/spec-extension/adapters/headers';

export async function getSupabase() {
  const cookieStore = cookies() as unknown as ReadonlyRequestCookies;
  const headerStore = headers() as unknown as ReadonlyHeaders;

  try {
    const allCookies = Array.from(cookieStore.getAll?.() || []);
    const allHeaders = Array.from(headerStore.entries?.() || []);

    console.log('[🔐 getSupabase] 🍪 Cookies:', allCookies);
    console.log('[🔐 getSupabase] 🧠 Headers:', allHeaders);
  } catch (err) {
    console.warn('[⚠️ getSupabase] Skipped cookie/header logging due to env mismatch:', err);
  }

  const supabase = createServerComponentClient({
    cookies: async () => cookieStore,
  });

  try {
    const session = await supabase.auth.getSession();
    console.log('[🔐 getSupabase] Session:', session);
  } catch (err) {
    console.error('[❌ getSupabase] Failed to get session:', err);
  }

  return supabase;
}
