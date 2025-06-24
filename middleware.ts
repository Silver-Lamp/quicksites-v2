// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { fetchUserByAccessToken } from '@/lib/supabase/server';

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const hostname = req.headers.get('host') || '';
  const pathname = req.nextUrl.pathname;

  const isRootDomain =
    hostname === 'localhost:3000' ||
    hostname === 'quicksites.ai' ||
    hostname === 'www.quicksites.ai';

  const subdomain = hostname
    .replace('.localhost:3000', '')
    .replace('.quicksites.ai', '')
    .replace('.vercel.app', '');

  const isPublicSite =
    !isRootDomain &&
    hostname.endsWith('.quicksites.ai') &&
    !pathname.startsWith('/admin') &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next');

  if (isPublicSite) {
    url.pathname = `/_sites/${subdomain}${pathname}`;
    return NextResponse.rewrite(url);
  }

  if (isRootDomain) {
    return NextResponse.next();
  }

  // 🔒 Admin route protection with role validation
  if (pathname.startsWith('/admin')) {
    const token = req.cookies.get('sb-access-token')?.value;
    if (!token) {
      console.warn('[🔒 Middleware] No Supabase access token found.');
      return NextResponse.redirect(new URL('/login?error=unauthorized', req.url));
    }

    const role = await fetchUserByAccessToken(token);
    if (!role || !['admin', 'owner', 'reseller'].includes(role)) {
      console.warn('[🔒 Middleware] Access denied due to role:', role);
      return NextResponse.redirect(new URL('/login?error=forbidden', req.url));
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/((?!_next|favicon.ico|api|static|site-assets).*)'],
};
