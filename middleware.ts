import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const hostname = req.headers.get('host') || '';
  const pathname = req.nextUrl.pathname;
  const subdomain = hostname
    .replace('.localhost:3000', '')
    .replace('.quicksites.ai', '')
    .replace('.vercel.app', '');

  const skipRoleCheck = true;

  const isPublicSite =
    hostname.endsWith('.quicksites.ai') &&
    !['www', 'quicksites'].includes(subdomain) &&
    !pathname.startsWith('/admin') &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next');

  // ⛳️ Rewrite subdomain to /_sites/[slug]
  if (isPublicSite) {
    const url = req.nextUrl.clone();
    url.pathname = `/_sites/${subdomain}${pathname}`;
    return NextResponse.rewrite(url);
  }

  // 🔒 Admin auth logic (Supabase) only runs if accessing /admin
  if (!skipRoleCheck && pathname.startsWith('/admin')) {
    const { supabase } = await import('@/admin/lib/supabaseClient');
    const res = NextResponse.next();
    const { data: { user } } = await supabase.auth.getUser(req.url.toString());

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
