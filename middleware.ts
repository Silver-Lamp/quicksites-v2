// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from './types/supabase';

const BASE_DOMAIN = 'quicksites.ai';
const ASSET = /\.(?:png|jpe?g|gif|svg|webp|ico|txt|xml|css|js|map|woff2?|ttf|otf)$/i;

const CACHE_TTL = 60_000;
const customDomainCache = new Map<string, { ts: number; slug: string }>();

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;

  // 0) Bypass internals & static (incl. common SW probes)
  if (
    path.startsWith('/_next') ||
    path.startsWith('/_vercel') ||
    path.startsWith('/.well-known') ||
    path === '/runtime-service-worker.js' ||
    ASSET.test(path)
  ) {
    return NextResponse.next();
  }

  // Allow APIs/marketing/admin/viewer untouched on any host
  if (
    path.startsWith('/api') ||
    path.startsWith('/admin') ||
    path.startsWith('/viewer') ||
    path.startsWith('/opengraph-image') ||
    path === '/robots.txt' ||
    path === '/sitemap.xml' ||
    path === '/favicon.ico' ||
    path === '/manifest.json'
  ) {
    return NextResponse.next();
  }

  // Don’t ever rewrite internal tenant paths
  if (path.startsWith('/_sites/')) {
    return NextResponse.next();
  }

  const rawHost = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').toLowerCase();
  const host = rawHost.replace(/:\d+$/, '');
  const baseHost = host.replace(/^www\./, '');

  const isLocal = /localhost|127\.0\.0\.1/.test(host);
  const isPlatform = !isLocal && (baseHost === BASE_DOMAIN || baseHost.endsWith(`.${BASE_DOMAIN}`));
  const isCustom = !isLocal && !isPlatform;

  // Platform subdomain → slug = first label
  if (isPlatform) {
    if (baseHost !== BASE_DOMAIN) {
      const sub = baseHost.replace(`.${BASE_DOMAIN}`, '').split('.')[0];
      if (sub && sub !== 'www') {
        const u = url.clone();
        u.pathname = `/_sites/${sub}${path === '/' ? '/home' : path}`;
        const res = NextResponse.rewrite(u);
        res.headers.set('x-qs-tenant', sub);
        return res;
      }
    }
    return NextResponse.next(); // marketing host
  }

  // Custom domain → lookup slug once per minute
  if (isCustom) {
    const now = Date.now();
    let cached = customDomainCache.get(baseHost);
    let slug = cached?.slug;

    if (!cached || now - cached.ts >= CACHE_TTL) {
      // auth-helper pattern requires a Response instance, but we don't need to return it
      const res = NextResponse.next();
      const supabase = createMiddlewareClient<Database>({ req, res });

      // Prefer your current schema/column names
      let { data: site } = await supabase
        .from('templates')
        .select('slug')
        .in('custom_domain', [baseHost, `www.${baseHost}`])
        .maybeSingle();

      // Fallback if you migrated column name
      if (!site) {
        const { data: site2 } = await supabase
          .from('templates')
          .select('slug')
          .in('domain', [baseHost, `www.${baseHost}`])
          .maybeSingle();
        site = site2 ?? null;
      }

      if (site?.slug) {
        slug = site.slug;
        customDomainCache.set(baseHost, { ts: now, slug: slug || '' });
      }
    }

    if (!slug) {
      // No mapping → let marketing or a custom 404 handle it
      return NextResponse.next();
    }

    const u = url.clone();
    u.pathname = `/_sites/${slug}${path === '/' ? '/home' : path}`;
    const res = NextResponse.rewrite(u);
    res.headers.set('x-qs-tenant', slug);
    return res;
  }

  // localhost, etc.
  return NextResponse.next();
}

export const config = {
  // Narrow matcher so we don't run for static/known asset paths twice
  matcher: [
    '/((?!_next/|_vercel|api/|admin|viewer|favicon.ico|sitemap.xml|robots.txt|manifest.json|opengraph-image|runtime-service-worker.js|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|woff2?|ttf|otf)$).*)',
  ],
};
