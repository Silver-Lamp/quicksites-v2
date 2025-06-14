import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareSupabaseClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const { supabase } = await import('@/admin/lib/supabaseClient');
  const res = NextResponse.next();
  const { data: { user } } = await supabase.auth.getUser(req.url.toString());

  const hostname = req.headers.get('host') || '';
  const subdomain = hostname
    .replace('.localhost:3000', '')
    .replace('.quicksites.ai', '')
    .replace('.vercel.app', '');

  const pathname = req.nextUrl.pathname;

  console.log('🔒 [Middleware]', {
    user,
    pathname,
    subdomain,
    roles: req.nextUrl.searchParams.get('roles'),
  });

  const skipRoleCheck = true;

  // Allow subdomain routing — catch all public site slugs like brutow-renton.quicksites.ai
  const isPublicSite = (
    hostname.endsWith('.quicksites.ai') &&
    !['www', 'quicksites'].includes(subdomain) &&
    !pathname.startsWith('/admin') &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next')
  );

  if (isPublicSite) {
    const url = req.nextUrl.clone();
    url.pathname = `/_sites/${subdomain}${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Only protect /admin routes
  if (!skipRoleCheck && pathname.startsWith('/admin')) {
    if (!user) {
      console.log('🔄 [Middleware] Redirecting to login', { user, pathname });
      return NextResponse.redirect(new URL('/login?error=unauthorized', req.url));
    }

    const role = user.user_metadata?.role;
    if (!['admin', 'owner', 'reseller'].includes(role)) {
      console.log('🔄 [Middleware] Redirecting to login', { user, pathname, role });
      return NextResponse.redirect(new URL('/login?error=forbidden', req.url));
    }
  }

  console.log('🔒 [Middleware] Skipping role check');
  return res;
}

export const config = {
  matcher: ['/', '/((?!_next|favicon.ico|api|static|site-assets).*)'],
};
