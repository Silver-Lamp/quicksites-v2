// lib/supabase/middlewareClient.ts
import { createServerClient } from '@supabase/ssr';
import type { Database } from '../../types/supabase';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Creates a Supabase client for use in Next.js middleware.
 * Be sure to return the `res` instance you pass in, or headers won't be applied.
 */
export function createMiddlewareSupabaseClient(req: NextRequest, res: NextResponse) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name, value, options) {
          // ✅ Attach Set-Cookie header via NextResponse
          res.cookies.set({ name, value, ...options });
        },
        remove(name) {
          res.cookies.set(name, '', { maxAge: 0 });
        },
      },
    }
  );
}
