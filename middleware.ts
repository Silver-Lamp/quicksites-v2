import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from './types/supabase';
import type { TemplateData } from './types/template';

const previewToken = process.env.SITE_PREVIEW_TOKEN || 'secret123';
const validSlugCache = new Map<string, { timestamp: number; firstPage: string }>();
const customDomainCache = new Map<string, { timestamp: number; slug: string }>();
const CACHE_TTL = 60_000;

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const host = req.headers.get('host') || '';
  const res = NextResponse.next();

  const isLocalhost =
    host.includes('localhost') || host.includes('lvh.me') || host.includes('127.0.0.1');
  const baseDomain = 'quicksites.ai';
  const hostWithoutPort = host.split(':')[0];

  const isCustomDomain = !isLocalhost && !hostWithoutPort.endsWith(baseDomain);

  // ✅ Extract subdomain if applicable
  const subdomain = (() => {
    if (isLocalhost) {
      const parts = hostWithoutPort.split('.');
      return parts.length === 2 && parts[1] === 'localhost' ? parts[0] : null;
    }
    if (hostWithoutPort.endsWith(baseDomain)) {
      const parts = hostWithoutPort.replace(`.${baseDomain}`, '').split('.');
      return parts[0] !== 'www' ? parts[0] : null;
    }
    return null;
  })();

  const isPreview = searchParams.get('preview') === previewToken;
  const isStaticAsset =
    pathname.startsWith('/_next') || pathname === '/favicon.ico' || pathname.endsWith('.js.map');

  console.log(`[middleware] host: ${host}, pathname: ${pathname}, subdomain: ${subdomain}, isCustomDomain: ${isCustomDomain}`);

  if (isStaticAsset) return res;

  const supabase = createMiddlewareClient<Database>({ req, res });

  // ✅ Handle subdomain homepage
  if (subdomain && pathname === '/') {
    const now = Date.now();
    const cached = validSlugCache.get(subdomain);
    const isFresh = cached && now - cached.timestamp < CACHE_TTL;

    if (isFresh) {
      const url = req.nextUrl.clone();
      url.pathname = `/sites/${subdomain}/${cached.firstPage}`;
      return NextResponse.rewrite(url);
    }

    let query = supabase
      .from('templates')
      .select('data')
      .eq('slug', subdomain)
      .eq('is_site', true)
      .limit(1);

    if (!isPreview) query = query.eq('published', true);

    const { data: site } = await query.maybeSingle();
    const pages = (site?.data as TemplateData)?.pages || [];
    const firstPage = pages.length > 0 ? pages[0].slug : 'home';

    if (site) {
      validSlugCache.set(subdomain, { timestamp: now, firstPage });
      const url = req.nextUrl.clone();
      url.pathname = `/sites/${subdomain}/${firstPage}`;
      return NextResponse.rewrite(url);
    } else {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  // ✅ Handle custom domain homepage
  if (isCustomDomain && pathname === '/') {
    const now = Date.now();
    const cached = customDomainCache.get(hostWithoutPort);
    let slug = cached?.slug;

    if (!slug || !cached || now - cached.timestamp >= CACHE_TTL) {
      const { data: site } = await supabase
        .from('templates')
        .select('slug, data')
        .eq('custom_domain', hostWithoutPort)
        .eq('published', true)
        .maybeSingle();

      if (site) {
        slug = site.slug;
        customDomainCache.set(hostWithoutPort, { timestamp: now, slug: slug || '' });
      }
    }

    if (slug) {
      const { data: site } = await supabase
        .from('templates')
        .select('data')
        .eq('slug', slug)
        .maybeSingle();

      const pages = (site?.data as TemplateData)?.pages || [];
      const firstPage = pages.length > 0 ? pages[0].slug : 'home';

      const url = req.nextUrl.clone();
      url.pathname = `/sites/${slug}/${firstPage}`;
      return NextResponse.rewrite(url);
    }
  }

  // ✅ Handle internal subdomain paths (e.g. /about)
  if (
    subdomain &&
    !pathname.startsWith('/sites') &&
    !pathname.startsWith('/admin') &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/api')
  ) {
    const url = req.nextUrl.clone();
    url.pathname = `/sites/${subdomain}${pathname}`;
    return NextResponse.rewrite(url);
  }

  // ✅ Handle internal custom domain paths (e.g. /contact)
  if (
    isCustomDomain &&
    !pathname.startsWith('/sites') &&
    !pathname.startsWith('/admin') &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/api') &&
    !isStaticAsset
  ) {
    const now = Date.now();
    const cached = customDomainCache.get(hostWithoutPort);
    let slug = cached?.slug;

    if (!slug || !cached || now - cached.timestamp >= CACHE_TTL) {
      const { data: site } = await supabase
        .from('templates')
        .select('slug')
        .eq('custom_domain', hostWithoutPort)
        .eq('published', true)
        .maybeSingle();

      if (site) {
        slug = site.slug;
        customDomainCache.set(hostWithoutPort, { timestamp: now, slug: slug || '' });
      }
    }

    if (slug) {
      const url = req.nextUrl.clone();
      url.pathname = `/sites/${slug}${pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  // ✅ Inject Supabase Auth headers
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
  }

  return res;
}

export const config = {
  matcher: ['/:path*'],
};
