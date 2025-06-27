import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';

export function getSupabase() {
  const cookieStore = cookies() as unknown as {
    get(name: string): { value: string } | undefined;
    getAll(): { name: string; value: string }[];
  };

  const headerStore = headers() as unknown as Headers;

  try {
    const allCookies = cookieStore.getAll();
    const allHeaders = Array.from(headerStore.entries());
    console.log('[🔐 getSupabase] 🍪 Cookies:', allCookies);
    console.log('[🔐 getSupabase] 🧠 Headers:', allHeaders);
  } catch (err) {
    console.warn('[⚠️ getSupabase] Error reading cookies/headers', err);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  return supabase;
}
