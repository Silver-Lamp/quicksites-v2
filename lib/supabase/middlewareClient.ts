// lib/supabase/middlewareClient.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '@/types/supabase';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function createMiddlewareSupabaseClient(req: NextRequest, res: NextResponse) {
  const secure = req.nextUrl.protocol === 'https:'; // false on localhost

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        getAll() {
          return req.cookies.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookies) {
          for (const { name, value, options } of cookies) {
            res.cookies.set(name, value, {
              ...(options as CookieOptions),
              secure,
              sameSite: 'lax',
              path: '/',
            });
          }
        },
      },
    }
  );
}
