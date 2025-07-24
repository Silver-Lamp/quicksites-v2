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
  const hostWithoutPort = host.split(':')[0];
  const res = NextResponse.next();

  const isLocalhost =
    host.includes('localhost') || host.includes('lvh.me') || host.includes('127.0.0.1');
  const baseDomain = 'quicksites.ai';
  const isCustomDomain = !isLocalhost && !hostWithoutPort.endsWith(baseDomain);

  // Optional: normalize www.
  // if (host.startsWith('www.')) {
  //   const cleanHost = host.replace('www.', '');
  //   const url = req.nextUrl.clone();
  //   url.hostname = cleanHost;
  //   return NextResponse.redirect(url);
  // }

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

  if (
    pathname.startsWith('/sites') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api') ||
    isStaticAsset
  ) {
    return res;
  }

  const supabase = createMiddlewareClient<Database>({ req, res });

  // ✅ Subdomain homepage routing
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
      console.warn(`[middleware] ❌ Invalid subdomain slug: ${subdomain}`);
      req.nextUrl.pathname = '/not-found-trigger';
      return NextResponse.rewrite(req.nextUrl);
    }
  }

  // ✅ Custom domain homepage
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

    if (!slug || slug === '') {
      console.warn(`[middleware] ❌ No slug found for custom domain: ${hostWithoutPort}`);
      req.nextUrl.pathname = '/not-found-trigger';
      return NextResponse.rewrite(req.nextUrl);
    }

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

  // ✅ Internal routes for subdomains
  if (subdomain) {
    const url = req.nextUrl.clone();
    url.pathname = `/sites/${subdomain}${pathname}`;
    return NextResponse.rewrite(url);
  }

  // ✅ Internal routes for custom domains
  if (isCustomDomain) {
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

    if (!slug || slug === '') {
      console.warn(`[middleware] ❌ Custom domain failed to resolve: ${hostWithoutPort}`);
      req.nextUrl.pathname = '/not-found-trigger';
      return NextResponse.rewrite(req.nextUrl);
    }

    const url = req.nextUrl.clone();
    url.pathname = `/sites/${slug}${pathname}`;
    return NextResponse.rewrite(url);
  }

  return res;
}

export const config = {
  matcher: ['/:path*'],
};
