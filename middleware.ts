// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from './types/supabase';

const customDomainCache = new Map<string, { ts: number; slug: string }>();
const LOG_TTL = 5 * 60 * 1000;
const CACHE_TTL = 60_000;

const logDedup = new Map<string, number>();

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
  if (logDedup.has(key) && now - logDedup.get(key)! < LOG_TTL) return;
  logDedup.set(key, now);

  // optional: write to your table (kept as a no-op if you removed supabaseAdmin)
  // await supabaseAdmin.from('middleware_404_logs').insert({ hostname, pathname, reason, ip_address });
}

function isPublicFile(pathname: string) {
  // any path that ends in ".ext"
  return /\.[^/]+$/.test(pathname);
}

export async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // Bypass webhooks and assets
  if (
    pathname.startsWith('/api/twilio-callback') ||
    pathname.startsWith('/api/stripe/webhook') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/_sites') || // don't rewrite our own app routes
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/runtime-service-worker.js' || // saw this in logs
    isPublicFile(pathname)
  ) {
    return NextResponse.next();
  }

  if (pathname === '/not-found-trigger') {
    nextUrl.pathname = '/404';
    return NextResponse.rewrite(nextUrl);
  }

  const host = req.headers.get('host') ?? '';
  const hostNoPort = host.split(':')[0];
  const baseHost = hostNoPort.replace(/^www\./, '');
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  const baseDomain = 'quicksites.ai';

  const isLocal =
    baseHost.includes('localhost') || baseHost.includes('lvh.me') || baseHost.includes('127.0.0.1');

  // custom domain = not localhost and not under *.quicksites.ai
  const isCustomDomain = !isLocal && !baseHost.endsWith(baseDomain);

  // subdomain on quicksites.ai
  const subdomain = (() => {
    if (isLocal) {
      const parts = baseHost.split('.');
      return parts.length >= 2 && parts.at(-1) === 'localhost'
        ? parts.slice(0, -1).join('.')
        : null;
    }
    if (baseHost === baseDomain) return null;
    if (baseHost.endsWith(`.${baseDomain}`)) {
      const without = baseHost.slice(0, -(`.${baseDomain}`).length);
      const first = without.split('.')[0];
      return first && first !== 'www' ? first : null;
    }
    return null;
  })();

  // robots/sitemap for custom domains
  if (isCustomDomain && pathname === '/sitemap.xml') {
    nextUrl.pathname = `/api/sitemap.xml/${baseHost}`;
    return NextResponse.rewrite(nextUrl);
  }
  if (isCustomDomain && pathname === '/robots.txt') {
    nextUrl.pathname = `/api/robots.txt/${baseHost}`;
    return NextResponse.rewrite(nextUrl);
  }

  // Subdomain: rewrite directly, preserve path
  if (subdomain) {
    const dest = new URL(
      `/_sites/${subdomain}${pathname === '/' ? '' : pathname}${nextUrl.search}`,
      req.url,
    );
    const res = NextResponse.rewrite(dest);
    res.headers.set('x-rewrite-to', dest.pathname); // handy in Vercel logs
    return res;
  }

  // Custom domain: look up slug from Supabase (cached)
  if (isCustomDomain) {
    const now = Date.now();
    let cached = customDomainCache.get(baseHost);
    let slug = cached?.slug;

    if (!slug || now - (cached?.ts ?? 0) >= CACHE_TTL) {
      const supabase = createMiddlewareClient<Database>({ req, res: NextResponse.next() });
      const { data: site } = await supabase
        .from('templates')
        .select('slug')
        .in('custom_domain', [baseHost, `www.${baseHost}`])
        .eq('published', true)
        .maybeSingle();

      if (!site?.slug) {
        await log404Once({
          hostname: baseHost,
          pathname,
          reason: 'custom domain slug not found',
          ip_address: ip,
        });
        nextUrl.pathname = '/not-found-trigger';
        return NextResponse.rewrite(nextUrl);
      }

      slug = site.slug as string;
      customDomainCache.set(baseHost, { ts: now, slug });
    }

    const dest = new URL(
      `/_sites/${slug}${pathname === '/' ? '' : pathname}${nextUrl.search}`,
      req.url,
    );
    const res = NextResponse.rewrite(dest);
    res.headers.set('x-rewrite-to', dest.pathname);
    return res;
  }

  // Otherwise, let the rest of the app handle it (marketing, admin, etc.)
  return NextResponse.next();
}

export const config = {
  // exclude: _next, any "file.ext", api, our own _sites subtree, and a few known assets
  matcher: [
    '/((?!_next|_sites|.*\\..*|api|favicon\\.ico|robots\\.txt|sitemap\\.xml|runtime-service-worker\\.js).*)',
  ],
};
