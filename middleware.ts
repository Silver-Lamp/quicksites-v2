// middleware.ts (root)
import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from './lib/supabase/admin';
import type { Database } from './types/supabase';

const previewToken = process.env.SITE_PREVIEW_TOKEN || 'secret123';
const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'quicksites.ai';

const CACHE_TTL = 60_000;
const LOG_DEDUP_TTL = 5 * 60_000;

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
    /\.(?:js\.map|json|txt|xml|svg|ico|png|jpg|jpeg|webp|gif|mp4|webm|woff2?|ttf|css)$/.test(pathname)
  );
}

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
    if (baseHost.endsWith('.localhost')) subdomain = baseHost.slice(0, -'.localhost'.length).split('.')[0] || null;
    else if (baseHost.endsWith('.lvh.me')) subdomain = baseHost.slice(0, -'.lvh.me'.length).split('.')[0] || null;
  } else if (baseHost !== BASE_DOMAIN && baseHost.endsWith(BASE_DOMAIN)) {
    const left = baseHost.slice(0, -(BASE_DOMAIN.length + 1));
    subdomain = left && left !== 'www' ? left.split('.')[0] : null;
  }

  return { host, baseHost, isLocal, isCustom, subdomain };
}

/** Preserve cookies on rewrite + expose a debug header. */
function rewrite(res: NextResponse, req: NextRequest, pathname: string) {
  const url = new URL(pathname, req.url);
  const out = NextResponse.rewrite(url, { request: req });
  for (const c of res.cookies.getAll()) out.cookies.set(c);
  out.headers.set('x-qsites-rewrite', url.pathname); // <-- check in DevTools > Network
  return out;
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const { pathname, searchParams } = url;

  // Skip obvious non-page routes
  if (
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/twilio-callback') ||
    pathname.startsWith('/api/stripe/webhook') ||
    isStatic(pathname)
  ) {
    return NextResponse.next();
  }

  // Keep Supabase session cookies fresh
  let res = NextResponse.next();
  try {
    const supabase = createMiddlewareClient<Database>({ req, res });
    await supabase.auth.getSession();
  } catch {}

  const hostHeader = req.headers.get('host') || '';
  const { host, baseHost, isCustom, subdomain } = deriveHostParts(hostHeader);
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const isPreview = searchParams.get('preview') === previewToken;

  // Let the app handle these directly
  if (pathname.startsWith('/sites') || pathname.startsWith('/admin') || pathname.startsWith('/login') || pathname.startsWith('/api')) {
    return res;
  }

  const supabase = createMiddlewareClient<Database>({ req, res });

  // Subdomain root -> /sites/{slug}/{firstPage}
  if (subdomain && pathname === '/') {
    const now = Date.now();
    const cached = validSlugCache.get(subdomain);
    if (cached && now - cached.timestamp < CACHE_TTL && !isPreview) {
      return rewrite(res, req, `/sites/${subdomain}/${cached.firstPage}`);
    }

    const { data: site } = await supabase
      .from('templates')
      .select('data')
      .eq('slug', subdomain)
      .eq('is_site', true)
      .eq('published', true)
      .maybeSingle();

    const pages = (site?.data as any)?.pages || [];
    const firstPage = pages.length ? pages[0].slug : 'home';

    if (site) {
      validSlugCache.set(subdomain, { timestamp: now, firstPage });
      return rewrite(res, req, `/sites/${subdomain}/${firstPage}`);
    }

    await log404Once({ hostname: baseHost, pathname, reason: 'subdomain slug not found', ip_address: ip });
    return rewrite(res, req, '/404');
  }

  // Custom domain root -> /sites/{slug}/{firstPage}
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
      await log404Once({ hostname: baseHost, pathname, reason: 'custom domain slug not found', ip_address: ip });
      return rewrite(res, req, '/404');
    }

    const { data: siteData } = await supabase
      .from('templates')
      .select('data')
      .eq('slug', slug)
      .maybeSingle();

    const pages = (siteData?.data as any)?.pages || [];
    const firstPage = pages.length ? pages[0].slug : 'home';

    return rewrite(res, req, `/sites/${slug}/${firstPage}`);
  }

  // Subdomain inner routes
  if (subdomain) {
    return rewrite(res, req, `/sites/${subdomain}${pathname}`);
  }

  // Custom domain inner routes
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
      await log404Once({ hostname: baseHost, pathname, reason: 'custom domain route not found', ip_address: ip });
      return rewrite(res, req, '/404');
    }

    return rewrite(res, req, `/sites/${slug}${pathname}`);
  }

  // Bare base domain -> fall through
  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|auth|.*\\.js\\.map|.*\\.json|.*\\.txt|.*\\.xml|.*\\.svg|.*\\.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.webp|.*\\.woff|.*\\.woff2|.*\\.ttf|api/twilio-callback|api/stripe/webhook).*)',
  ],
};
