// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const MARKETING_HOSTS = new Set(['quicksites.ai', 'www.quicksites.ai']); // hosts that should NOT rewrite
const ASSET_RE = /\.(?:png|jpe?g|gif|svg|webp|ico|txt|xml|css|js|map)$/i;

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hostHdr = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').toLowerCase();
  const domain = hostHdr.replace(/^www\./, '');

  // ---------- 1) Tenant routing by host ----------
  if (!MARKETING_HOSTS.has(domain)) {
    // For customer domains, rewrite everything except APIs/static to the tenant renderer
    if (
      !pathname.startsWith('/api') &&
      !pathname.startsWith('/_next') &&
      !pathname.startsWith('/.well-known') &&
      !ASSET_RE.test(pathname)
    ) {
      const url = req.nextUrl.clone();
      url.pathname = `/_sites/${domain}${pathname}`; // page at app/_sites/[key]/...
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // ---------- 2) Marketing/app host flow ----------
  // Let assets & APIs straight through
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/.well-known') ||
    pathname.startsWith('/api') ||
    ASSET_RE.test(pathname) ||
    pathname === '/login' ||
    pathname.startsWith('/auth/callback')
  ) {
    return NextResponse.next();
  }

  // Only gate /admin/* with Supabase auth
  const res = NextResponse.next();
  if (!pathname.startsWith('/admin')) return res;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll().map(({ name, value }) => ({ name, value })),
        setAll: (cookies) => {
          const secure = req.nextUrl.protocol === 'https:'; // false on localhost
          for (const { name, value, options } of cookies) {
            res.cookies.set(name, value, { ...(options as CookieOptions), secure });
          }
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const login = new URL('/login', req.url);
    login.searchParams.set('next', pathname + (search || ''));
    const redirectRes = NextResponse.redirect(login);
    for (const c of res.headers.getSetCookie?.() ?? []) redirectRes.headers.append('set-cookie', c);
    return redirectRes;
  }

  return res;
}

export const config = {
  // runs on everything except static assets / next internals / your cron
  matcher: ['/((?!api/cron|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|txt|xml|css|js|map)).*)'],
};
