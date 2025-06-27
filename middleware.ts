import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSlugContext } from './lib/supabase/getSlugContext';

const DEBUG = process.env.DEBUG_AUTH === 'true';

export async function middleware(req: NextRequest) {
  const start = Date.now();
  const res = NextResponse.next();

  const { pathname } = req.nextUrl;
  const hostname = req.headers.get('host') || '';

  const isRoot = ['localhost:3000', 'quicksites.ai', 'www.quicksites.ai'].includes(hostname);
  const isAdminRoute = pathname.startsWith('/admin');
  const isApiOrStatic =
    pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.startsWith('/static');

  if (DEBUG) {
    console.log('\n🌐 [Middleware Triggered]');
    console.log('Host:', hostname);
    console.log('Path:', pathname);
  }

  // 🔁 Rewrite for multi-tenant sites
  if (!isRoot && !isAdminRoute && !isApiOrStatic) {
    const { slug, source } = await getSlugContext();
    if (slug && slug !== 'default') {
      const url = req.nextUrl.clone();
      url.pathname = `/_sites/${slug}${pathname}`;
      if (DEBUG) {
        console.log(`[🧭 Rewrite → Tenant] via ${source}: ${hostname} → ${url.pathname}`);
      }
      return NextResponse.rewrite(url);
    }
  }

  // 🏠 Allow root access
  if (isRoot) {
    if (DEBUG) console.log('[🏠 Root Access Allowed]', pathname);
    return res;
  }

  // 🔐 Admin route protection
  if (isAdminRoute) {
    const setupTime = Date.now();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value;
          },
        },
      }
    );

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    const authTime = Date.now();
    const user = session?.user;

    if (DEBUG) {
      console.log('🔐 Session User:', user?.email || 'null');
      if (sessionError) console.warn('⚠️ Session error:', sessionError.message);
    }

    if (!user) {
      if (DEBUG) console.warn('[⛔️ Unauthenticated → /login]');
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
      if (profileError) console.warn('❌ Profile Error:', profileError.message);
    }

    if (!['admin', 'owner', 'reseller'].includes(role)) {
      if (DEBUG) console.warn('[🚫 Role Forbidden → /login]');
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

  // ✅ Default passthrough
  return res;
}

export const config = {
  matcher: ['/', '/((?!_next|favicon.ico|api|static|site-assets).*)'],
};
