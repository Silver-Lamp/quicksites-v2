// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareSupabaseClient } from '@supabase/auth-helpers-nextjs';

const DEBUG = process.env.DEBUG_AUTH === 'true';

export async function middleware(req: NextRequest) {
  const start = Date.now();
  const res = NextResponse.next();

  const { pathname } = req.nextUrl;
  const hostname = req.headers.get('host') || '';
  const isRoot = ['localhost:3000', 'quicksites.ai', 'www.quicksites.ai'].includes(hostname);

  const subdomain = hostname
    .replace('.localhost:3000', '')
    .replace('.quicksites.ai', '')
    .replace('.vercel.app', '');

  const isPublicSite =
    !isRoot &&
    hostname.endsWith('.quicksites.ai') &&
    !pathname.startsWith('/admin') &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next');

  if (DEBUG) {
    console.log('\n🌐 [Middleware Triggered]');
    console.log('Host:', hostname);
    console.log('Path:', pathname);
  }

  // 🔀 Public site rewrite
  if (isPublicSite) {
    const url = req.nextUrl.clone();
    url.pathname = `/_sites/${subdomain}${pathname}`;
    DEBUG && console.log('[🧭 Rewrite → Public Site]', url.pathname);
    return NextResponse.rewrite(url);
  }

  // 🏠 Allow root site
  if (isRoot) {
    DEBUG && console.log('[🏠 Root Access Allowed]', pathname);
    return res;
  }

  // 🔒 Protect admin routes
  if (pathname.startsWith('/admin')) {
    const setupTime = Date.now();

    const supabase = createMiddlewareSupabaseClient({ req, res });
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    const authTime = Date.now();

    const user = session?.user;

    if (DEBUG) {
      console.log('🔐 Session User:', user?.email || 'null');
      sessionError && console.warn('⚠️ Session error:', sessionError.message);
    }

    if (!user) {
      DEBUG && console.warn('[⛔️ Unauthenticated → /login]');
      return NextResponse.redirect(new URL('/login?error=unauthorized', req.url));
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    const dbTime = Date.now();

    const role = profile?.role;

    if (DEBUG) {
      console.log('📄 Profile Role:', role);
      profileError && console.warn('❌ Profile Error:', profileError.message);
    }

    if (!['admin', 'owner', 'reseller'].includes(role)) {
      DEBUG && console.warn('[🚫 Role Forbidden → /login]');
      return NextResponse.redirect(new URL('/login?error=forbidden', req.url));
    }

    if (DEBUG) {
      const total = Date.now() - start;
      console.log('⏱️ Timing:', {
        setup: `${setupTime - start}ms`,
        auth: `${authTime - setupTime}ms`,
        profile: `${dbTime - authTime}ms`,
        total: `${total}ms`,
      });
    }

    return res;
  }

  // ✅ Default pass-through
  return res;
}

export const config = {
  matcher: ['/', '/((?!_next|favicon.ico|api|static|site-assets).*)'],
};
