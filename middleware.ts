import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from './lib/supabase/admin';
import type { Database } from './types/supabase';
import type { TemplateData } from './types/template';

const previewToken = process.env.SITE_PREVIEW_TOKEN || 'secret123';
const validSlugCache = new Map<string, { timestamp: number; firstPage: string }>();
const customDomainCache = new Map<string, { timestamp: number; slug: string }>();
const logCache = new Map<string, number>();
const CACHE_TTL = 60_000;
const LOG_DEDUP_TTL = 5 * 60 * 1000;

async function log404Once({
  hostname,
  pathname,
  reason,
  ip_address,
}: {
  hostname: string;
  pathname: string;
  reason: string;
  ip_address: string;
}) {
  const key = `${hostname}::${pathname}::${reason}`;
  const now = Date.now();
  if (logCache.has(key) && now - logCache.get(key)! < LOG_DEDUP_TTL) return;
  logCache.set(key, now);

  await supabaseAdmin.from('middleware_404_logs').insert({
    hostname,
    pathname,
    reason,
    ip_address,
  });
}

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // ✅ Bypass Twilio or Stripe webhooks (safer: startsWith)
  if (
    pathname.startsWith('/api/twilio-callback') ||
    pathname.startsWith('/api/stripe/webhook')
  ) {
    console.log('[middleware] bypassing webhook for', pathname);
    return NextResponse.next();
  }

  if (pathname.endsWith('.js.map')) return NextResponse.next();
  if (/\.(js\.map|json|txt|xml|svg|ico|png|jpg|jpeg|webp|woff2?|woff)$/i.test(pathname)) {
    return NextResponse.next();
  }

  if (pathname === '/not-found-trigger') {
    req.nextUrl.pathname = '/404';
    return NextResponse.rewrite(req.nextUrl);
  }

  const host = req.headers.get('host') || '';
  const hostWithoutPort = host.split(':')[0];
  const baseHost = hostWithoutPort.replace(/^www\./, '');
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const res = NextResponse.next();

  const isLocalhost =
    host.includes('localhost') || host.includes('lvh.me') || host.includes('127.0.0.1');
  const baseDomain = 'quicksites.ai';
  const isCustomDomain = !isLocalhost && !baseHost.endsWith(baseDomain);

  const subdomain = (() => {
    if (isLocalhost) {
      const parts = baseHost.split('.');
      return parts.length === 2 && parts[1] === 'localhost' ? parts[0] : null;
    }
    if (baseHost === baseDomain) return null;
    if (baseHost.endsWith(baseDomain)) {
      const parts = baseHost.replace(`.${baseDomain}`, '').split('.');
      return parts[0] !== 'www' ? parts[0] : null;
    }
    return null;
  })();

  const isPreview = searchParams.get('preview') === previewToken;
  const isStaticAsset = pathname.startsWith('/_next') || pathname === '/favicon.ico';

  console.log(
    `[middleware] host: ${host}, pathname: ${pathname}, subdomain: ${subdomain}, isCustomDomain: ${isCustomDomain}`
  );

  if (isCustomDomain && pathname === '/sitemap.xml') {
    req.nextUrl.pathname = `/api/sitemap.xml/${baseHost}`;
    return NextResponse.rewrite(req.nextUrl);
  }

  if (isCustomDomain && pathname === '/robots.txt') {
    req.nextUrl.pathname = `/api/robots.txt/${baseHost}`;
    return NextResponse.rewrite(req.nextUrl);
  }

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

  if (subdomain && pathname === '/') {
    const now = Date.now();
    const cached = validSlugCache.get(subdomain);
    if (cached && now - cached.timestamp < CACHE_TTL) {
      req.nextUrl.pathname = `/sites/${subdomain}/${cached.firstPage}`;
      return NextResponse.rewrite(req.nextUrl);
    }

    const { data: site } = await supabase
      .from('templates')
      .select('data')
      .eq('slug', subdomain)
      .eq('is_site', true)
      .eq('published', true)
      .maybeSingle();

    const pages = (site?.data as TemplateData)?.pages || [];
    const firstPage = pages.length > 0 ? pages[0].slug : 'home';

    if (site) {
      validSlugCache.set(subdomain, { timestamp: now, firstPage });
      req.nextUrl.pathname = `/sites/${subdomain}/${firstPage}`;
      return NextResponse.rewrite(req.nextUrl);
    }

    await log404Once({
      hostname: baseHost,
      pathname,
      reason: 'subdomain slug not found',
      ip_address: ip,
    });

    req.nextUrl.pathname = '/not-found-trigger';
    return NextResponse.rewrite(req.nextUrl);
  }

  if (isCustomDomain && pathname === '/') {
    const now = Date.now();
    const cached = customDomainCache.get(baseHost);
    let slug = cached?.slug;

    if (!slug || !cached || now - cached.timestamp >= CACHE_TTL) {
      const { data: site } = await supabase
        .from('templates')
        .select('slug, data')
        .in('custom_domain', [baseHost, `www.${baseHost}`])
        .eq('published', true)
        .maybeSingle();

      if (site) {
        slug = site.slug;
        customDomainCache.set(baseHost, { timestamp: now, slug: slug || '' });
      }
    }

    if (!slug) {
      await log404Once({
        hostname: baseHost,
        pathname,
        reason: 'custom domain slug not found',
        ip_address: ip,
      });

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

    req.nextUrl.pathname = `/sites/${slug}/${firstPage}`;
    return NextResponse.rewrite(req.nextUrl);
  }

  if (subdomain) {
    req.nextUrl.pathname = `/sites/${subdomain}${pathname}`;
    return NextResponse.rewrite(req.nextUrl);
  }

  if (isCustomDomain) {
    const now = Date.now();
    const cached = customDomainCache.get(baseHost);
    let slug = cached?.slug;

    if (!slug || !cached || now - cached.timestamp >= CACHE_TTL) {
      const { data: site } = await supabase
        .from('templates')
        .select('slug')
        .in('custom_domain', [baseHost, `www.${baseHost}`])
        .eq('published', true)
        .maybeSingle();

      if (site) {
        slug = site.slug;
        customDomainCache.set(baseHost, { timestamp: now, slug: slug || '' });
      }
    }

    if (!slug) {
      await log404Once({
        hostname: baseHost,
        pathname,
        reason: 'custom domain route not found',
        ip_address: ip,
      });

      req.nextUrl.pathname = '/not-found-trigger';
      return NextResponse.rewrite(req.nextUrl);
    }

    req.nextUrl.pathname = `/sites/${slug}${pathname}`;
    return NextResponse.rewrite(req.nextUrl);
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.js\\.map|.*\\.json|.*\\.txt|.*\\.xml|.*\\.svg|.*\\.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.webp|.*\\.woff|.*\\.woff2|api/twilio-callback|api/stripe/webhook).*)',
  ],
};
