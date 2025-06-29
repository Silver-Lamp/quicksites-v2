// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from './types/supabase';

/**
 * Middleware to protect /admin/* routes via Supabase session check.
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[❌ middleware] Missing Supabase environment variables');
    return NextResponse.redirect(new URL('/login?error=missing_config', req.url));
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options?: CookieOptions) {
        res.cookies.set(name, value, options);
      },
      remove(name: string) {
        res.cookies.set(name, '', { maxAge: 0 });
      },
    },
  });

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.warn('[⚠️ middleware] Supabase session error:', error.message);
  }

  const user = session?.user;

  if (!user) {
    console.log('[🔐 middleware] No session found — redirecting to login');
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('error', 'unauthorized');
    loginUrl.searchParams.set('redirect', req.nextUrl.pathname); // Optional deep linking
    return NextResponse.redirect(loginUrl);
  }

  console.log('[✅ middleware] Authenticated user:', user.email);
  res.headers.set('x-user-id', user.id); // Optional observability

  return res;
}

export const config = {
  matcher: ['/admin/:path*'],
};
