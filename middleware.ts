// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from './types/supabase';
import { safeParse } from './lib/safeCookies';

/**
 * Middleware to protect /admin/* routes via Supabase session check,
 * and injects user context headers for layout + analytics.
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[❌ middleware] Missing Supabase env vars');
    const loginUrl = new URL('/login?error=missing_config', req.url);
    return NextResponse.redirect(loginUrl);
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        const raw = req.cookies.get(name)?.value;
        if (!raw) return undefined;
        if (name.startsWith('sb-')) return raw;
        return safeParse(raw);
      },
      set(name, value, options?: CookieOptions) {
        const encoded = typeof value === 'string' ? value : JSON.stringify(value);
        res.cookies.set(name, encoded, options);
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
    loginUrl.searchParams.set('redirect', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  console.log('[✅ middleware] Authenticated user:', user.email);

  // Enrich request with headers used in getRequestContext()
  res.headers.set('x-user-id', user.id);
  res.headers.set('x-user-email', user.email ?? '');
  res.headers.set('x-user-role', user.user_metadata?.role ?? 'viewer');
  res.headers.set('x-user-name', user.user_metadata?.name ?? '');
  res.headers.set('x-user-avatar-url', user.user_metadata?.avatar_url ?? '');

  // Optional: add analytics headers
  res.headers.set('x-user-agent', req.headers.get('user-agent') ?? '');
  res.headers.set('x-ip', req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '');
  res.headers.set('x-trace-id', req.headers.get('x-trace-id') ?? '');
  res.headers.set('x-session-id', req.headers.get('x-session-id') ?? '');
  res.headers.set('x-ab-variant', req.cookies.get('ab-variant')?.value ?? '');

  // Add experimental A/B and session variant headers from cookies
  const abVariant = req.cookies.get('ab-variant')?.value ?? '';
  const sessionId = req.cookies.get('session-id')?.value ?? '';

  if (abVariant) res.headers.set('x-ab-variant', abVariant);
  if (sessionId) res.headers.set('x-session-id', sessionId);

  return res;
}

export const config = {
  matcher: ['/admin/:path*'],
};
