// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Domains that are the *app* (NOT user sites)
const APP_HOSTS = new Set<string>([
  'quicksites.ai',
  'www.quicksites.ai',
  'localhost:3000',
]);

// Paths that should bypass rewrites entirely
const IGNORE_PATHS: RegExp[] = [
  /^\/_next\//,
  /^\/static\//,
  /^\/favicon\.ico$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /^\/manifest\.json$/,
  // common asset/file types
  /\.(?:js\.map|json|txt|xml|svg|ico|png|jpg|jpeg|webp|gif|mp4|webm|woff2?|ttf|css)$/i,
  // webhooks & public APIs you don’t want rewritten
  /^\/api\/twilio-callback/,
  /^\/api\/stripe\/webhook/,
];

function isIgnored(pathname: string) {
  return IGNORE_PATHS.some((re) => re.test(pathname));
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hostHeader =
    req.headers.get('x-forwarded-host') ??
    req.headers.get('host') ??
    '';

  // Quick exits for assets / special routes
  if (isIgnored(pathname)) return NextResponse.next();

  // App routes should pass through untouched
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/sites') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_sites') // host-based page itself
  ) {
    return NextResponse.next();
  }

  const host = hostHeader.toLowerCase();
  const isAppHost = APP_HOSTS.has(host);

  // If we're on an app host (quicksites.ai / localhost), do nothing.
  if (isAppHost) {
    return NextResponse.next();
  }

  // Otherwise this is a custom domain or user subdomain.
  // Rewrite to the host-based route while preserving the original path and query.
  const url = req.nextUrl.clone();
  url.pathname = `/_sites${pathname}`;
  const res = NextResponse.rewrite(url);

  // Debug header so you can confirm rewrites in DevTools Network
  res.headers.set('x-qsites-rewrite', url.pathname + (search || ''));
  return res;
}

export const config = {
  matcher: [
    // run on everything except the common static buckets; keep in sync with IGNORE_PATHS
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.json|.*\\.(?:js\\.map|json|txt|xml|svg|ico|png|jpg|jpeg|webp|gif|mp4|webm|woff2?|ttf|css)).*)',
  ],
};
