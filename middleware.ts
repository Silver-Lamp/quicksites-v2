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

  // Helper to attach cookie to whichever response we return
  const withRefCookie = (res: NextResponse) => {
    if (wantsRefCookie) {
      res.cookies.set(COOKIE_NAME, ref!, {
        httpOnly: false,
        sameSite: 'lax',
        secure: COOKIE_SECURE,
        path: '/',
        maxAge: COOKIE_MAX_AGE,
      });
      // optional: keep a debug header
      res.headers.set('x-qsites-ref', ref!);
    }
    return res;
  };

  // ---- Let app/internal routes pass through untouched ----
  if (
    isIgnored(pathname) ||
    pathname.startsWith('/host') ||     // host handler
    pathname.startsWith('/admin') ||
    pathname.startsWith('/sites') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api')        // keep your APIs intact (webhooks, etc.)
  ) {
    return withRefCookie(NextResponse.next());
  }

  // Host header
  const hostHeader =
    req.headers.get('x-forwarded-host') ??
    req.headers.get('host') ??
    '';
  const host = hostHeader.toLowerCase();

  // If this is our app host, don't rewrite (normal dashboard/app pages).
  if (APP_HOSTS.has(host) || host.endsWith('.vercel.app')) {
    return withRefCookie(NextResponse.next());
  }

  // ---- Otherwise, this is a site request on a custom domain or subdomain ----
  const rewriteUrl = req.nextUrl.clone();
  // Preserve the original path under /host for your catch-all route
  rewriteUrl.pathname = `/host${pathname === '/' ? '' : pathname}`;
  // Keep the query string intact
  // (ref is already captured to cookie; we still pass it through harmlessly)
  // rewriteUrl.search remains as-is

  const res = NextResponse.rewrite(rewriteUrl);
  // helpful debug headers (visible in DevTools → Network → Response Headers)
  res.headers.set('x-qsites-rewrite', `${rewriteUrl.pathname}${rewriteUrl.search || ''}`);
  res.headers.set('x-qsites-host', host);

  return withRefCookie(res);
}

export const config = {
  // Apply middleware to everything except common static buckets above.
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.json|.*\\.(?:js(?:\\.map)?|mjs|cjs|json|txt|xml|svg|ico|png|jpg|jpeg|gif|webp|avif|mp4|webm|css|woff2?|ttf)).*)',
  ],
};
