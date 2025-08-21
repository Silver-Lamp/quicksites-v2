// middleware.ts
// (compat path; uses _sites and Supabase lookup)
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from './types/supabase';

const BASE_DOMAIN = 'quicksites.ai';
const ASSET = /\.(?:png|jpe?g|gif|svg|webp|ico|txt|xml|css|js|map|woff2?)$/i;

const CACHE_TTL = 60_000;
const customDomainCache = new Map<string, { ts: number; slug: string }>();

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;

  // skip Next internals & assets
  if (path.startsWith('/_next') || path.startsWith('/.well-known') || ASSET.test(path)) {
    return NextResponse.next();
  }
  // let APIs pass through (so /api/_debug/host works on every domain)
  if (path.startsWith('/api')) return NextResponse.next();

  const rawHost = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').toLowerCase();
  const host = rawHost.replace(/:\d+$/, '');
  const baseHost = host.replace(/^www\./, '');

  const isLocal = /localhost|127\.0\.0\.1/.test(host);
  const isPlatform =
    !isLocal && (baseHost === BASE_DOMAIN || baseHost.endsWith(`.${BASE_DOMAIN}`));
  const isCustom = !isLocal && !isPlatform;

  // per-domain sitemap/robots
  if (isCustom && path === '/sitemap.xml') {
    const u = url.clone(); u.pathname = `/api/sitemap.xml/${baseHost}`; return NextResponse.rewrite(u);
  }
  if (isCustom && path === '/robots.txt') {
    const u = url.clone(); u.pathname = `/api/robots.txt/${baseHost}`; return NextResponse.rewrite(u);
  }

  // Subdomain under platform → slug = subdomain
  if (isPlatform) {
    if (baseHost !== BASE_DOMAIN) {
      const sub = baseHost.replace(`.${BASE_DOMAIN}`, '').split('.')[0];
      if (sub && sub !== 'www') {
        const u = url.clone();
        // If your _sites page is NOT catch-all, drop the path:
        u.pathname = `/_sites/${sub}`;      // <- always land on the site root
        // If you later add a catch-all, switch to:
        // u.pathname = `/_sites/${sub}${path === '/' ? '' : path}`;
        return NextResponse.rewrite(u);
      }
    }
    return NextResponse.next(); // marketing host(s)
  }

  // Custom domain → lookup slug in templates
  if (isCustom) {
    const now = Date.now();
    let cached = customDomainCache.get(baseHost);
    let slug = cached?.slug;

    if (!cached || now - cached.ts >= CACHE_TTL) {
      const res = NextResponse.next(); // required by auth-helpers
      const supabase = createMiddlewareClient<Database>({ req, res });

      // Prefer your current schema
      let { data: site } = await supabase
        .from('templates')
        .select('slug')
        .in('custom_domain', [baseHost, `www.${baseHost}`]) // <- your old schema
        .eq('published', true)
        .maybeSingle();

      // If you ever migrated to `domain` instead of `custom_domain`, this fallback helps:
      if (!site) {
        const { data: site2 } = await supabase
          .from('templates')
          .select('slug')
          .in('domain', [baseHost, `www.${baseHost}`])
          .eq('published', true)
          .maybeSingle();
        site = site2 ?? null;
      }

      if (site?.slug) {
        slug = site.slug;
        cached = { ts: now, slug: slug || '' };
        customDomainCache.set(baseHost, cached);
      }
    }

    if (!slug) {
      const u = url.clone(); u.pathname = '/404'; return NextResponse.rewrite(u);
    }

    const u = url.clone();
    // If your _sites page is NOT catch-all, drop the path:
    // u.pathname = `/_sites/${slug}`;        // <- always land on the site root
    // If you later add a catch-all, switch to:
    u.pathname = `/_sites/${slug}${path === '/' ? '' : path}`;
    return NextResponse.rewrite(u);
  }

  // default (localhost, marketing root, etc.)
  return NextResponse.next();
}

export const config = { matcher: ['/:path*'] };
