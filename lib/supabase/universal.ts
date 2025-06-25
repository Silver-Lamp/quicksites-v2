import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies, headers } from 'next/headers';

export async function getSupabase() {
  const cookieStore = await cookies();
  const headerStore = await headers();

  try {
    const allCookies = cookieStore.getAll();
    const allHeaders = Array.from(headerStore.entries());
    console.log('[🔐 getSupabase] 🍪 Cookies:', allCookies);
    console.log('[🔐 getSupabase] 🧠 Headers:', allHeaders);
  } catch (err) {
    console.warn('[⚠️ getSupabase] Error reading cookies/headers', err);
  }

  const supabase = createServerComponentClient({
    cookies: async () => cookies(),
  });

  return supabase;
}
