import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareSupabaseClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const { supabase } = await import('@/admin/lib/supabaseClient');
  const res = NextResponse.next();
  const { data: { user } } = await supabase.auth.getUser(req.url.toString());

  console.log('🔒 [Middleware]', { user, pathname: req.nextUrl.pathname, roles: req.nextUrl.searchParams.get('roles') });

  const skipRoleCheck = true;
  if (skipRoleCheck) {
    console.log('🔒 [Middleware] Skipping role check');
    return res;
  }

  const pathname = req.nextUrl.pathname;

  // Only protect /admin routes
  if (pathname.startsWith('/admin')) {
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

  return res;
}
