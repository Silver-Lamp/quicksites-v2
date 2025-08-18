// lib/supabase/route.ts
import { NextResponse } from 'next/server';
import { cookies as nextCookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

export async function serverClientForResponse(res: NextResponse) {
  const store = await nextCookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(cookies) {
          for (const { name, value, options } of cookies) {
            res.cookies.set({ name, value, ...(options ?? {}) });
          }
        },
      },
      cookieEncoding: 'base64url',
    }
  );
}
