// middleware.ts

import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from './types/supabase';
import type { TemplateData } from './types/template';

const previewToken = process.env.SITE_PREVIEW_TOKEN || 'secret123';

const validSlugCache = new Map<string, { timestamp: number; firstPage: string }>();
const CACHE_TTL = 60_000;

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const host = req.headers.get('host') || '';
  const res = NextResponse.next();

  const isLocalhost = host.includes('localhost') || host.includes('lvh.me') || host.includes('127.0.0.1');
  const baseDomain = 'quicksites.ai';

  // ✅ Prevent subdomain logic from activating on localhost
  const subdomain = (() => {
    if (isLocalhost) return null;
    if (!host.endsWith(baseDomain)) return null;
    const parts = host.replace(`.${baseDomain}`, '').split('.');
    const name = parts[0];
    return name !== 'www' ? name : null;
  })();

  const isPreview = searchParams.get('preview') === previewToken;

  console.log(`[middleware] host: ${host}, pathname: ${pathname}, subdomain: ${subdomain}`);

  if (pathname.endsWith('.js.map')) return res;

  // ✅ Rewrite root `/` for subdomain to /sites/[slug]/[firstPage]
  if (subdomain && pathname === '/') {
    const now = Date.now();
    const cached = validSlugCache.get(subdomain);
    const isFresh = cached && now - cached.timestamp < CACHE_TTL;

    if (isFresh) {
      const url = req.nextUrl.clone();
      url.pathname = `/sites/${subdomain}/${cached.firstPage}`;
      console.log(`[middleware] ✅ Rewriting / to cached: ${url.pathname}`);
      return NextResponse.rewrite(url);
    }

    const supabase = createMiddlewareClient<Database>({ req, res });

    let query = supabase
      .from('templates')
      .select('data')
      .eq('slug', subdomain)
      .eq('is_site', true)
      .limit(1);

    if (!isPreview) {
      query = query.eq('published', true);
    }

    const { data: site, error } = await query.maybeSingle();

    const pages = (site?.data as TemplateData)?.pages || [];
    const firstPage = pages.length > 0 ? pages[0].slug : 'home';

    if (site && !error) {
      validSlugCache.set(subdomain, { timestamp: now, firstPage });
      const url = req.nextUrl.clone();
      url.pathname = `/sites/${subdomain}/${firstPage}`;
      console.log(`[middleware] ✅ Rewriting / to ${url.pathname}`);
      return NextResponse.rewrite(url);
    } else {
      console.warn(`[middleware] ⚠️ Invalid or unpublished site: ${subdomain}`, { error });
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  // ✅ Rewrite /contact etc. → /sites/[slug]/contact for subdomains
  if (
    subdomain &&
    pathname !== '/' &&
    !pathname.startsWith('/sites') &&
    !pathname.startsWith('/admin') &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/favicon.ico')
  ) {
    const url = req.nextUrl.clone();
    url.pathname = `/sites/${subdomain}${pathname}`;
    console.log(`[middleware] ✏️ Rewriting ${pathname} → ${url.pathname}`);
    return NextResponse.rewrite(url);
  }

  // ✅ Auth headers for /admin routes
  const supabase = createMiddlewareClient<Database>({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user;

  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    const resolvedRole = profile?.role || 'guest';

    res.headers.set('x-user-id', user.id);
    res.headers.set('x-user-email', user.email ?? '');
    res.headers.set('x-user-role', resolvedRole);
    res.headers.set('x-user-name', user.user_metadata?.name ?? '');
    res.headers.set('x-user-avatar-url', user.user_metadata?.avatar_url ?? '');

    console.log(`[middleware] 🔐 Set headers for ${user.email}`);
  }

  return res;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/login',
    '/',
    '/(.*)',
  ],
};
