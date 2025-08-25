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
  // your webhooks / special APIs that must not be rewritten
  /^\/api\/twilio-callback/,
  /^\/api\/stripe\/webhook/,
];

function isIgnored(pathname: string) {
  return IGNORE_PATHS.some((re) => re.test(pathname));
}

export function middleware(req: NextRequest) {
  const u = req.nextUrl;
  const pathname = u.pathname;
  const search = u.search || '';

  // Already on our handler or an API/static path? Let it pass.
  if (
    isIgnored(pathname) ||
    pathname.startsWith('/host') ||     // host handler
    pathname.startsWith('/admin') ||
    pathname.startsWith('/sites') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api')        // keep your APIs intact
  ) {
    return NextResponse.next();
  }

  const hostHeader =
    req.headers.get('x-forwarded-host') ??
    req.headers.get('host') ??
    '';

  const host = hostHeader.toLowerCase();

  // If this is our app host, don't rewrite (normal dashboard/app pages).
  if (APP_HOSTS.has(host)) {
    return NextResponse.next();
  }

  // Otherwise, this is a site request on a custom domain, *.quicksites.ai, or *.localhost
  const rewriteUrl = req.nextUrl.clone();
  // Preserve the original path under /host for your catch-all route
  rewriteUrl.pathname = `/host${pathname === '/' ? '' : pathname}`;
  // Keep query string
  rewriteUrl.search = search;

  const res = NextResponse.rewrite(rewriteUrl);
  // helpful debug headers (visible in DevTools → Network → Response Headers)
  res.headers.set('x-qsites-rewrite', `${rewriteUrl.pathname}${rewriteUrl.search || ''}`);
  res.headers.set('x-qsites-host', host);
  return res;
}

export const config = {
  // Apply middleware to everything except the common static buckets above.
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.json|.*\\.(?:js(?:\\.map)?|mjs|cjs|json|txt|xml|svg|ico|png|jpg|jpeg|gif|webp|avif|mp4|webm|css|woff2?|ttf)).*)',
  ],
};
