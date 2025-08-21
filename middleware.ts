// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const MARKETING = new Set([
  'quicksites.ai',
  'www.quicksites.ai',
  'localhost:3000',          // dev safety
  '127.0.0.1:3000',
]);

const ASSET = /\.(?:png|jpe?g|gif|svg|webp|ico|txt|xml|css|js|map|woff2?)$/i;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').toLowerCase();
  const domain = host.replace(/^www\./, '');

  // Skip assets, Next internals, well-known, and API
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/.well-known') ||
    pathname.startsWith('/api') ||
    ASSET.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Rewrites for customer domains
  if (!MARKETING.has(domain)) {
    const url = req.nextUrl.clone();
    url.pathname = `/_sites/${domain}${pathname || ''}`;
    return NextResponse.rewrite(url);
  }

  // Marketing / app host behaves normally
  return NextResponse.next();
}

export const config = { matcher: ['/:path*'] };
