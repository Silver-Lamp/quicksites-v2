import { NextResponse } from 'next/server.js';
import type { NextRequest } from 'next/server.js';

export async function middleware(req: NextRequest) {
  const hostname = req.headers.get('host') || '';
  const pathname = req.nextUrl.pathname;

  // Detect known root domains (including localhost, www, etc.)
  const isRootDomain =
    hostname === 'localhost:3000' ||
    hostname === 'quicksites.ai' ||
    hostname === 'www.quicksites.ai';

  const subdomain = hostname
    .replace('.localhost:3000', '')
    .replace('.quicksites.ai', '')
    .replace('.vercel.app', '');

  const skipRoleCheck = true;

  // Public subdomain (like brutow-renton.quicksites.ai)
  const isPublicSite =
    !isRootDomain &&
    hostname.endsWith('.quicksites.ai') &&
    !pathname.startsWith('/admin') &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next');

  if (isPublicSite) {
    const url = req.nextUrl.clone();
    url.pathname = `/_sites/${subdomain}${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Allow home page to render for quicksites.ai (no rewrite)
  if (isRootDomain) {
    return NextResponse.next();
  }

  // 🔒 Admin route auth
  if (!skipRoleCheck && pathname.startsWith('/admin')) {
    const { supabase } = await import('@/admin/lib/supabaseClient');
    const res = NextResponse.next();
    const {
      data: { user },
    } = await supabase.auth.getUser(req.url.toString());

    console.log('🔒 [Middleware] Checking admin auth:', { pathname, user });

    if (!user) {
      return NextResponse.redirect(new URL('/login?error=unauthorized', req.url));
    }

    const role = user.user_metadata?.role;
    if (!['admin', 'owner', 'reseller'].includes(role)) {
      return NextResponse.redirect(new URL('/login?error=forbidden', req.url));
    }

    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/((?!_next|favicon.ico|api|static|site-assets).*)'],
};
