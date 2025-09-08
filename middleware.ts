// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/** Hosts that should NOT be rewritten (your app itself). */
const APP_HOSTS = new Set<string>([
  'localhost:3000',
  '127.0.0.1:3000',
  '::1:3000',

  // QuickSites app/marketing hosts
  'quicksites.ai',
  'www.quicksites.ai',
  'app.quicksites.ai',

  // CedarSites app/marketing hosts (adjust to your real domains)
  'cedarsites.com',
  'www.cedarsites.com',
  'app.cedarsites.com',
]);

/** Paths we should never rewrite (Next internals, assets, specific APIs). */
const IGNORE_PATHS: RegExp[] = [
  /^\/_next\//,
  /^\/static\//,
  /^\/favicon\.ico$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /^\/manifest\.json$/,
  // common static extensions
  /\.(?:js(?:\.map)?|mjs|cjs|json|txt|xml|svg|ico|png|jpg|jpeg|gif|webp|avif|mp4|webm|css|woff2?|ttf)$/i,
  // webhooks / special APIs that must not be rewritten
  /^\/api\/twilio-callback/,
  /^\/api\/stripe\/webhook/,
  /^\/api\/commerce\/webhooks\/stripe/,
  /^\/api\/billing\/webhooks\/stripe/,
];

function isIgnored(pathname: string) {
  return IGNORE_PATHS.some((re) => re.test(pathname));
}

function splitHostPort(h: string) {
  const [hostname, port] = (h || '').toLowerCase().split(':');
  return { hostname: hostname ?? '', port: port ?? '' };
}

function subdomainFromDevHost(hostname: string): string | null {
  if (hostname.endsWith('.localhost')) {
    return hostname.slice(0, -'.localhost'.length);
  }
  if (hostname.endsWith('.lvh.me')) {
    return hostname.slice(0, -'.lvh.me'.length);
  }
  if (hostname.endsWith('.127.0.0.1.nip.io')) {
    return hostname.slice(0, -'.127.0.0.1.nip.io'.length);
  }
  return null;
}

// cookies
const REF_COOKIE = 'qs_ref';
const REF_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

// dev org override cookie (used by resolveOrg())
const ORG_COOKIE = 'qs_org_slug';
const ORG_MAX_AGE = 60 * 60; // 1 hour (dev convenience)
const ORG_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,63}$/i;

const COOKIE_SECURE = process.env.NODE_ENV === 'production';

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const { pathname, searchParams } = url;

  // --- capture ?ref=... (affiliates) ---
  const ref = searchParams.get('ref')?.trim();
  const wantsRefCookie = !!ref && ref.length <= 64;

  // --- dev toggle: ?org=<slug> to override org; ?org=clear to remove ---
  const orgParam = searchParams.get('org')?.trim().toLowerCase() || null;
  const wantsOrgSet = !!orgParam && orgParam !== 'clear' && ORG_SLUG_RE.test(orgParam);
  const wantsOrgClear = orgParam === 'clear';

  const withCookies = (res: NextResponse) => {
    if (wantsRefCookie) {
      // Use object overload for types-compat
      res.cookies.set({
        name: REF_COOKIE,
        value: ref!,
        httpOnly: false,
        sameSite: 'lax',
        secure: COOKIE_SECURE,
        path: '/',
        maxAge: REF_MAX_AGE,
      });
      res.headers.set('x-qsites-ref', ref!);
    }

    if (wantsOrgSet) {
      res.cookies.set({
        name: ORG_COOKIE,
        value: orgParam!,
        httpOnly: false,
        sameSite: 'lax',
        secure: COOKIE_SECURE,
        path: '/',
        maxAge: ORG_MAX_AGE,
      });
      res.headers.set('x-qsites-org', orgParam!);
    } else if (wantsOrgClear) {
      // Delete also uses object overload (name+path in one arg)
      res.cookies.delete({ name: ORG_COOKIE, path: '/' });
      res.headers.set('x-qsites-org-cleared', '1');
    }
    return res;
  };

  // ---- Let app/internal routes pass through untouched ----
  if (
    isIgnored(pathname) ||
    pathname.startsWith('/host') ||
    pathname.startsWith('/_domains') || // ✅ your domain router
    pathname.startsWith('/admin') ||
    pathname.startsWith('/sites') ||    // ✅ path-based site preview
    pathname.startsWith('/login') ||
    pathname.startsWith('/api')
  ) {
    return withCookies(NextResponse.next());
  }

  // Host header
  const hostHeader = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
  const host = hostHeader.toLowerCase();
  const { hostname } = splitHostPort(hostHeader);

  // If this is our app host, don't rewrite (normal dashboard/app pages).
  if (APP_HOSTS.has(host) || host.endsWith('.vercel.app')) {
    return withCookies(NextResponse.next());
  }

  // ---- Dev subdomain → /sites/<sub> rewrite (e.g., foo.localhost:3000) ----
  const devSub = subdomainFromDevHost(hostname);
  if (devSub && !['www', 'app'].includes(devSub)) {
    const rewriteUrl = req.nextUrl.clone();
    rewriteUrl.pathname = `/sites/${devSub}${pathname === '/' ? '' : pathname}`;
    const res = NextResponse.rewrite(rewriteUrl);
    res.headers.set('x-qsites-dev-sub', devSub);
    res.headers.set('x-qsites-rewrite', rewriteUrl.pathname + (rewriteUrl.search || ''));
    return withCookies(res);
  }

  // ---- Real custom domain → directly to /sites/<slug>/<page> ----
  const hostLc = hostname.toLowerCase().replace(/\.$/, '');
  const noWww = hostLc.replace(/^www\./, '');
  // Derive slug from apex label (e.g., www.graftontowing.com → graftontowing)
  const parts = noWww.split('.');
  const apexLabel = (parts.length > 1 ? parts.slice(0, -1).join('.') : parts[0]) || noWww;

  // Default root "/" to "/home" (your renderer expects a page)
  const extra = pathname === '/' ? '/home' : pathname;

  const rewriteUrl = req.nextUrl.clone();
  rewriteUrl.pathname = `/sites/${apexLabel}${extra}`;

  const res = NextResponse.rewrite(rewriteUrl);
  res.headers.set('x-qsites-host-in', hostname);
  res.headers.set('x-qsites-slug', apexLabel);
  res.headers.set('x-qsites-rewrite', rewriteUrl.pathname + (rewriteUrl.search || ''));
  return withCookies(res);

}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.json|.*\\.(?:js(?:\\.map)?|mjs|cjs|json|txt|xml|svg|ico|png|jpg|jpeg|gif|webp|avif|mp4|webm|css|woff2?|ttf)).*)',
  ],
};
