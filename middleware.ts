// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Domains that are the *app* (NOT user sites)
const APP_HOSTS = new Set<string>([
  'quicksites.ai',
  'www.quicksites.ai',
  'localhost:3000',
]);

const IGNORE_PATHS: RegExp[] = [
  /^\/_next\//,
  /^\/static\//,
  /^\/favicon\.ico$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /^\/manifest\.json$/,
  /\.(?:js\.map|json|txt|xml|svg|ico|png|jpg|jpeg|webp|gif|mp4|webm|woff2?|ttf|css)$/i,
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

  if (isIgnored(pathname)) return NextResponse.next();

  // Let app + our host route + our diagnose route pass through
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/sites') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api') ||      // includes /api/host-diagnose
    pathname.startsWith('/host')        // <-- new host handler path
  ) {
    return NextResponse.next();
  }

  const host = hostHeader.toLowerCase();
  const isAppHost = APP_HOSTS.has(host);
  if (isAppHost) return NextResponse.next();

  // Rewrite custom domains to /host + original path
  const url = req.nextUrl.clone();
  url.pathname = `/host${pathname}`;
  const res = NextResponse.rewrite(url);
  res.headers.set('x-qsites-rewrite', url.pathname + (search || ''));
  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.json|.*\\.(?:js\\.map|json|txt|xml|svg|ico|png|jpg|jpeg|webp|gif|mp4|webm|woff2?|ttf|css)).*)',
  ],
};