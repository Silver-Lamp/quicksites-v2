import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '../../types/supabase';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { safeParse } from '../safeCookies';

/**
 * Creates a Supabase client for use in Next.js middleware.
 * Be sure to return the `res` instance you pass in, or headers won't be applied.
 */
export function createMiddlewareSupabaseClient(
  req: NextRequest,
  res: NextResponse
) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const raw = req.cookies.get(name)?.value;
          if (!raw) return undefined;

          if (name.startsWith('sb-')) return raw;

          const parsed = safeParse<string>(raw);
          return typeof parsed === 'string' ? parsed : undefined;
        },
        set(name: string, value: string, options?: CookieOptions) {
          res.cookies.set(name, value, options);
        },
        remove(name: string) {
          res.cookies.set(name, '', { maxAge: 0 });
        },
      },
    }
  );
}
