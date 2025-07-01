// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from './types/supabase';

/**
 * Middleware to protect /admin/* routes via Supabase session check,
 * and injects user context headers for layout + analytics.
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createMiddlewareClient<Database>({ req, res });

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.warn('[⚠️ middleware] Supabase session error:', error.message);
  }

  // 🛑 If authenticated and accessing /login, redirect away
  if (req.nextUrl.pathname === '/login' && session?.user) {
    return NextResponse.redirect(new URL('/admin/dashboard', req.url));
  }

  const user = session?.user;

  if (!user && req.nextUrl.pathname.startsWith('/admin')) {
    console.log('[🔐 middleware] No session found — redirecting to login');
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('error', 'unauthorized');
    loginUrl.searchParams.set('redirect', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user) {
    console.log('[✅ middleware] Authenticated user:', user.email);

    // 🧠 Inject identity and context headers
    res.headers.set('x-user-id', user.id);
    res.headers.set('x-user-email', user.email ?? '');
    res.headers.set('x-user-role', user.user_metadata?.role ?? 'viewer');
    res.headers.set('x-user-name', user.user_metadata?.name ?? '');
    res.headers.set('x-user-avatar-url', user.user_metadata?.avatar_url ?? '');

    // 📊 Optional: analytics / debugging headers
    res.headers.set('x-user-agent', req.headers.get('user-agent') ?? '');
    res.headers.set('x-ip', req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '');
    res.headers.set('x-trace-id', req.headers.get('x-trace-id') ?? '');
    res.headers.set('x-ab-variant', req.cookies.get('ab-variant')?.value ?? '');
    res.headers.set('x-session-id', req.cookies.get('session-id')?.value ?? '');
  }

  return res;
}

export const config = {
  matcher: ['/admin/:path*', '/login'],
};
