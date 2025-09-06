// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/** Hosts that should NOT be rewritten (your app itself). */
const APP_HOSTS = new Set<string>([
  'localhost:3000',
  '127.0.0.1:3000',
  '::1:3000',
  'quicksites.ai',
  'www.quicksites.ai',
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

// cookie settings
const COOKIE_NAME = 'qs_ref';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days
const COOKIE_SECURE = process.env.NODE_ENV === 'production';

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const { pathname } = url;

  // ---- Capture ?ref=CODE into a cookie (do this for ANY route) ----
  const ref = url.searchParams.get('ref')?.trim();
  const wantsRefCookie = !!ref && ref.length <= 64; // basic sanity cap
  const withRefCookie = (res: NextResponse) => {
    if (wantsRefCookie) {
      res.cookies.set(COOKIE_NAME, ref!, {
        httpOnly: false,
        sameSite: 'lax',
        secure: COOKIE_SECURE,
        path: '/',
        maxAge: COOKIE_MAX_AGE,
      });
      res.headers.set('x-qsites-ref', ref!);
    }
    return res;
  };

  // ---- Let app/internal routes pass through untouched ----
  if (
    isIgnored(pathname) ||
    pathname.startsWith('/host') ||     // host handler (if you keep it)
    pathname.startsWith('/_domains') || // ✅ allow your _domains router
    pathname.startsWith('/admin') ||
    pathname.startsWith('/sites') ||    // ✅ allow path-based site preview
    pathname.startsWith('/login') ||
    pathname.startsWith('/api')         // keep your APIs intact
  ) {
    return withRefCookie(NextResponse.next());
  }

  // Host header
  const hostHeader = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
  const host = hostHeader.toLowerCase();
  const { hostname } = splitHostPort(hostHeader);

  // If this is our app host, don't rewrite (normal dashboard/app pages).
  if (APP_HOSTS.has(host) || host.endsWith('.vercel.app')) {
    return withRefCookie(NextResponse.next());
  }

  // ---- Dev subdomain → /sites/<sub> rewrite (e.g., foo.localhost:3000) ----
  const devSub = subdomainFromDevHost(hostname);
  if (devSub && !['www', 'app'].includes(devSub)) {
    const rewriteUrl = req.nextUrl.clone();
    rewriteUrl.pathname = `/sites/${devSub}${pathname === '/' ? '' : pathname}`;
    const res = NextResponse.rewrite(rewriteUrl);
    res.headers.set('x-qsites-dev-sub', devSub);
    res.headers.set('x-qsites-rewrite', rewriteUrl.pathname + (rewriteUrl.search || ''));
    return withRefCookie(res);
  }

  // ---- Real custom domain → _domains/<domain> router ----
  const rewriteUrl = req.nextUrl.clone();
  rewriteUrl.pathname = `/_domains/${hostname}${pathname === '/' ? '' : pathname}`;
  const res = NextResponse.rewrite(rewriteUrl);
  res.headers.set('x-qsites-domain', hostname);
  res.headers.set('x-qsites-rewrite', rewriteUrl.pathname + (rewriteUrl.search || ''));
  return withRefCookie(res);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.json|.*\\.(?:js(?:\\.map)?|mjs|cjs|json|txt|xml|svg|ico|png|jpg|jpeg|gif|webp|avif|mp4|webm|css|woff2?|ttf)).*)',
  ],
};
