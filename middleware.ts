import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareSupabaseClient } from '@supabase/auth-helpers-nextjs';

const DEBUG = process.env.DEBUG_AUTH === 'true';

export async function middleware(req: NextRequest) {
  const start = Date.now();
  const hostname = req.headers.get('host') || '';
  const pathname = req.nextUrl.pathname;
  const url = req.nextUrl.clone();

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

  if (DEBUG) {
    console.log('\n🌐 [Request Context]');
    console.log('Host:', hostname);
    console.log('Path:', pathname);
    console.log('Cookies:', Object.fromEntries(req.cookies.entries()));
    console.log('Headers:', {
      'x-forwarded-for': req.headers.get('x-forwarded-for'),
      'user-agent': req.headers.get('user-agent'),
      cookie: req.headers.get('cookie')?.slice(0, 100) + '...',
    });
  }

  if (isPublicSite) {
    url.pathname = `/_sites/${subdomain}${pathname}`;
    DEBUG && console.log('[🧭 Public Site Rewrite]', url.pathname);
    return NextResponse.rewrite(url);
  }

  if (isRootDomain) {
    DEBUG && console.log('[🏠 Root Domain Pass-through]', pathname);
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin')) {
    const setupTime = Date.now();
    const supabase = createMiddlewareSupabaseClient({ req });
    const res = NextResponse.next();

    const {
      data: { user, session },
      error,
    } = await supabase.auth.getSession();

    const authTime = Date.now();

    if (DEBUG) {
      console.log('\n🔐 [Session Retrieved]');
      console.log('User:', user);
      console.log('Session JWT:', session?.access_token?.slice(0, 16) + '…');
      console.log('Auth error:', error);
    }

    if (!user) {
      DEBUG && console.warn('[⛔️ Not signed in → /login]');
      return NextResponse.redirect(new URL('/login?error=unauthorized', req.url));
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    const dbTime = Date.now();

    if (DEBUG) {
      console.log('📄 [Profile Role Lookup]', profile);
      if (profileError) {
        console.error('[❌ Role Fetch Error]', profileError.message);
      }
    }

    const role = profile?.role;

    if (!['admin', 'owner', 'reseller'].includes(role)) {
      DEBUG && console.warn('[🚫 Unauthorized Role → /login?forbidden]');
      return NextResponse.redirect(new URL('/login?error=forbidden', req.url));
    }

    const end = Date.now();

    if (DEBUG) {
      console.log('\n⏱️ [Timing Breakdown]');
      console.log(`• Setup:      ${setupTime - start}ms`);
      console.log(`• Auth fetch: ${authTime - setupTime}ms`);
      console.log(`• Role fetch: ${dbTime - authTime}ms`);
      console.log(`• Total:      ${end - start}ms\n`);
    }

    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/((?!_next|favicon.ico|api|static|site-assets).*)'],
};
