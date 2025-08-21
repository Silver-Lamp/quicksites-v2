// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const MARKETING = new Set([
  'quicksites.ai',
  'www.quicksites.ai',
  'localhost:3000',
  '127.0.0.1:3000',
]);

const ASSET = /\.(?:png|jpe?g|gif|svg|webp|ico|txt|xml|css|js|map|woff2?)$/i;

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').toLowerCase();
  const domain = host.replace(/^www\./, '');

  // Skip Next internals, well-known, assets
  if (path.startsWith('/_next') || path.startsWith('/.well-known') || ASSET.test(path)) {
    return NextResponse.next();
  }

  // Let APIs go straight through (no rewrite)
  if (path.startsWith('/api')) return NextResponse.next();

  // Customer domains → rewrite to domain router
  if (!MARKETING.has(domain)) {
    const rew = url.clone();
    rew.pathname = `/_domains/${domain}${path}`;
    return NextResponse.rewrite(rew);
  }

  // Marketing/app hosts: normal
  return NextResponse.next();
}

export const config = { matcher: ['/:path*'] };
