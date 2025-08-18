// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const PUBLIC_PATHS = [
  '/', '/login', '/auth/callback',
  '/api/auth/whoami', '/api/auth/debug-cookies',
];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Allow public routes straight through
  if (
    PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/')) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/.well-known') ||
    /\.(png|jpg|jpeg|gif|svg|webp|ico|txt|xml)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const res = NextResponse.next();

  // Supabase SSR client bound to req/res cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookies) {
          const secure = req.nextUrl.protocol === 'https:'; // false on localhost
          for (const { name, value, options } of cookies) {
            res.cookies.set(name, value, { ...(options as CookieOptions), secure });
          }
        },
      },
    }
  );

  // Only gate /admin/*
  const needsAuth = pathname.startsWith('/admin');

  if (!needsAuth) return res;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!user || error) {
    const login = new URL('/login', req.url);
    login.searchParams.set('next', pathname + (search || ''));
    // carry any Set-Cookie from res onto the redirect response
    const redirectRes = NextResponse.redirect(login);
    for (const c of res.headers.getSetCookie?.() ?? []) redirectRes.headers.append('Set-Cookie', c);
    return redirectRes;
  }

  return res;
}

export const config = {
  matcher: ['/((?!api/cron|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|txt|xml)).*)'],
};
