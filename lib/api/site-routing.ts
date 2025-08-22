// lib/api/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareSupabaseClient } from '@/lib/supabase/middlewareClient';
import type { Database } from '@/types/supabase';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { TemplateData } from '@/types/template';

// ---------- config / small caches ----------
const previewToken = process.env.SITE_PREVIEW_TOKEN || 'secret123';
const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'quicksites.ai';

const CACHE_TTL = 60_000;         // 60s
const LOG_DEDUP_TTL = 5 * 60_000; // 5m

const validSlugCache = new Map<string, { timestamp: number; firstPage: string }>();
const customDomainCache = new Map<string, { timestamp: number; slug: string }>();
const logCache = new Map<string, number>();

async function log404Once(args: {
  hostname: string;
  pathname: string;
  reason: string;
  ip_address: string;
}) {
  const key = `${args.hostname}::${args.pathname}::${args.reason}`;
  const now = Date.now();
  if (logCache.has(key) && now - (logCache.get(key) || 0) < LOG_DEDUP_TTL) return;
  logCache.set(key, now);
  await supabaseAdmin.from('middleware_404_logs').insert(args);
}

function isStatic(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/fonts/') ||
    /\.(?:js\.map|json|txt|xml|svg|ico|png|jpg|jpeg|webp|gif|mp4|webm|woff2?|ttf|css)$/.test(
      pathname
    )
  );
}

/** Treat localhost/0.0.0.0/127.0.0.1/::1 and *.lvh.me as local. Extract subdomains for both local and prod. */
function deriveHostParts(hostHeader: string) {
  const hostWithPort = hostHeader || '';
  const host = hostWithPort.split(':')[0];
  const baseHost = host.replace(/^www\./, '');

  const isLocal =
    baseHost === 'localhost' ||
    baseHost.endsWith('.localhost') ||
    baseHost === '127.0.0.1' ||
    baseHost === '0.0.0.0' ||
    baseHost === '::1' ||
    baseHost === 'lvh.me' ||
    baseHost.endsWith('.lvh.me');

  const isCustom = !isLocal && !baseHost.endsWith(BASE_DOMAIN);

  let subdomain: string | null = null;

  if (isLocal) {
    if (baseHost.endsWith('.localhost')) {
      // e.g. sub.localhost
      const left = baseHost.slice(0, -'.localhost'.length);
      subdomain = left && left !== 'www' ? left.split('.')[0] : null;
    } else if (baseHost.endsWith('.lvh.me')) {
      // e.g. sub.lvh.me
      const left = baseHost.slice(0, -'.lvh.me'.length);
      subdomain = left && left !== 'www' ? left.split('.')[0] : null;
    } else {
      subdomain = null; // bare localhost/0.0.0.0/etc.
    }
  } else if (baseHost !== BASE_DOMAIN && baseHost.endsWith(BASE_DOMAIN)) {
    const left = baseHost.slice(0, -(BASE_DOMAIN.length + 1)); // strip ".basedomain"
    subdomain = left && left !== 'www' ? left.split('.')[0] : null;
  }

  return { host, baseHost, isLocal, isCustom, subdomain };
}

/** Create a rewrite response that preserves any cookies already added to `res`. */
function rewritePreservingCookies(res: NextResponse, url: URL, req: NextRequest) {
  const out = NextResponse.rewrite(url, { request: req });
  for (const c of res.cookies.getAll()) {
    // `set` accepts a ResponseCookie object directly
    out.cookies.set(c);
    // If your types are too strict in your setup, this also works:
    // const { name, value, ...opts } = c as any;
    // out.cookies.set(name, value, opts);
  }
  return out;
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const { pathname, searchParams } = url;

  // Bypass auth routes entirely
  if (pathname.startsWith('/auth/')) return NextResponse.next();

  // Bypass webhooks & obvious assets early
  if (
    pathname.startsWith('/api/twilio-callback') ||
    pathname.startsWith('/api/stripe/webhook') ||
    isStatic(pathname)
  ) {
    return NextResponse.next();
  }

  // Always pass the same response instance so Supabase cookies stick
  let res = NextResponse.next();

  // Keep Supabase session cookies fresh (no manual cookie parsing!)
  try {
    const supabase = createMiddlewareSupabaseClient(req, res);
    await supabase.auth.getSession();
  } catch {
    // ignore — still route fine
  }

  const hostHeader = req.headers.get('host') || '';
  const { host, baseHost, isLocal, isCustom, subdomain } = deriveHostParts(hostHeader);
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const isPreview = searchParams.get('preview') === previewToken;

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[middleware] host: ${host}, path: ${pathname}, sub: ${subdomain}, isCustom: ${isCustom}`);
  }

  // Custom domain sitemap / robots passthrough
  if (isCustom && pathname === '/sitemap.xml') {
    url.pathname = `/api/sitemap.xml/${baseHost}`;
    return rewritePreservingCookies(res, url, req);
  }
  if (isCustom && pathname === '/robots.txt') {
    url.pathname = `/api/robots.txt/${baseHost}`;
    return rewritePreservingCookies(res, url, req);
  }

  // Let the app handle these directly
  if (
    pathname.startsWith('/sites') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api')
  ) {
    return res;
  }

  // Scoped client for DB reads used below (shares the same `res`)
  const supabase = createMiddlewareSupabaseClient(req, res);

  // ---------- Subdomain root: /  ->  /_sites/{slug}/{firstPage} ----------
  if (subdomain && pathname === '/') {
    const now = Date.now();
    const cached = validSlugCache.get(subdomain);
    if (cached && now - cached.timestamp < CACHE_TTL && !isPreview) {
      url.pathname = `/_sites/${subdomain}/${cached.firstPage}`;
      return rewritePreservingCookies(res, url, req);
    }

    const { data: site } = await supabase
      .from('templates')
      .select('data')
      .eq('slug', subdomain)
      .eq('is_site', true)
      .eq('published', true)
      .maybeSingle();

    const pages = (site?.data as TemplateData | undefined)?.pages || [];
    const firstPage = pages.length > 0 ? pages[0].slug : 'home';

    if (site) {
      validSlugCache.set(subdomain, { timestamp: Date.now(), firstPage });
      url.pathname = `/_sites/${subdomain}/${firstPage}`;
      return rewritePreservingCookies(res, url, req);
    }

    await log404Once({
      hostname: baseHost,
      pathname,
      reason: 'subdomain slug not found',
      ip_address: ip,
    });

    url.pathname = '/404';
    return rewritePreservingCookies(res, url, req);
  }

  // ---------- Custom domain root: /  ->  /_sites/{slug}/{firstPage} ----------
  if (isCustom && pathname === '/') {
    const now = Date.now();
    let cached = customDomainCache.get(baseHost);
    let slug = cached?.slug;

    if (!slug || now - (cached?.timestamp || 0) >= CACHE_TTL || isPreview) {
      const { data: site } = await supabase
        .from('templates')
        .select('slug, data')
        .in('custom_domain', [baseHost, `www.${baseHost}`])
        .eq('published', true)
        .maybeSingle();

      if (site?.slug) {
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
      url.pathname = '/404';
      return rewritePreservingCookies(res, url, req);
    }

    const { data: siteData } = await supabase
      .from('templates')
      .select('data')
      .eq('slug', slug)
      .maybeSingle();

    const pages = (siteData?.data as TemplateData | undefined)?.pages || [];
    const firstPage = pages.length ? pages[0].slug : 'home';

    url.pathname = `/_sites/${slug}/${firstPage}`;
    return rewritePreservingCookies(res, url, req);
  }

  // ---------- Subdomain inner routes ----------
  if (subdomain) {
    url.pathname = `/_sites/${subdomain}${pathname}`;
    return rewritePreservingCookies(res, url, req);
  }

  // ---------- Custom domain inner routes ----------
  if (isCustom) {
    const now = Date.now();
    let cached = customDomainCache.get(baseHost);
    let slug = cached?.slug;

    if (!slug || now - (cached?.timestamp || 0) >= CACHE_TTL) {
      const { data: site } = await supabase
        .from('templates')
        .select('slug')
        .in('custom_domain', [baseHost, `www.${baseHost}`])
        .eq('published', true)
        .maybeSingle();

      if (site?.slug) {
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
      url.pathname = '/404';
      return rewritePreservingCookies(res, url, req);
    }

    url.pathname = `/_sites/${slug}${pathname}`;
    return rewritePreservingCookies(res, url, req);
  }

  // Bare base domain → fall through to app (homepage, marketing, etc.)
  return res;
}

export const config = {
  // Don’t run on static files, /auth/*, or the two webhook endpoints
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|auth|.*\\.js\\.map|.*\\.json|.*\\.txt|.*\\.xml|.*\\.svg|.*\\.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.webp|.*\\.woff|.*\\.woff2|.*\\.ttf|api/twilio-callback|api/stripe/webhook).*)',
  ],
};
