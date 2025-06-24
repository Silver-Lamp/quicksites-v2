// ---- middleware.ts ----
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerUserProfile } from './lib/supabase/getServerUserProfile';

export async function middleware(req: NextRequest) {
  const hostname = req.headers.get('host') || '';
  const pathname = req.nextUrl.pathname;

  const isRootDomain =
    hostname === 'localhost:3000' ||
    hostname === 'quicksites.ai' ||
    hostname === 'www.quicksites.ai';

  const subdomain = hostname
    .replace('.localhost:3000', '')
    .replace('.quicksites.ai', '')
    .replace('.vercel.app', '');

  const isPublicSite =
    !isRootDomain &&
    hostname.endsWith('.quicksites.ai') &&
    !pathname.startsWith('/admin') &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next');

  if (isPublicSite) {
    const url = req.nextUrl.clone();
    url.pathname = `/_sites/${subdomain}${pathname}`;
    return NextResponse.rewrite(url);
  }

  if (isRootDomain) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin')) {
    const profile = await getServerUserProfile();

    if (!profile || !['admin', 'owner', 'reseller'].includes(profile.role)) {
      return NextResponse.redirect(new URL('/login?error=forbidden', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/((?!_next|favicon.ico|api|static|site-assets).*)'],
};
