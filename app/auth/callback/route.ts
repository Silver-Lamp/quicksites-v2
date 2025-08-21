// app/auth/callback/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { serialize, type SerializeOptions } from 'cookie';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const originOf = (req: NextRequest) => {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
};

// include ::1 and 0.0.0.0
const isLocal = (req: NextRequest) => {
  const h = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').toLowerCase();
  return (
    /(^|:)localhost(?::|$)/.test(h) ||
    /(^|:)127\.0\.0\.1(?::|$)/.test(h) ||
    /(^|:)0\.0\.0\.0(?::|$)/.test(h) ||
    /(^|:)\[?::1\]?(?::|$)/.test(h)
  );
};

function parseCookieHeader(raw: string | null) {
  if (!raw) return [] as { name: string; value: string }[];
  return raw.split(/;\s*/).filter(Boolean).map(p => {
    const i = p.indexOf('=');
    return { name: i < 0 ? p : p.slice(0, i), value: i < 0 ? '' : p.slice(i + 1) };
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const requestedNext = url.searchParams.get('next');
  const nextPath = requestedNext && requestedNext.startsWith('/') ? requestedNext : '/admin/tools';

  if (!code) {
    return NextResponse.redirect(
      new URL(`/login?error=missing_code&next=${encodeURIComponent(nextPath)}`, originOf(req))
    );
  }

  // Prepare a 302 redirect response up-front
  const redirectRes = NextResponse.redirect(new URL(nextPath, originOf(req)));

  const local = isLocal(req);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => parseCookieHeader(req.headers.get('cookie')),
        setAll: (cookies) => {
          for (const { name, value, options } of cookies) {
            const o = { ...(options ?? {}) } as SerializeOptions;
            o.path = '/';
            delete (o as any).domain; // never set domain on localhost

            if (local) {
              o.sameSite = 'lax';
              o.secure = false;
            } else {
              const same = (o.sameSite ?? 'lax') as SerializeOptions['sameSite'];
              if ((same as any) === 'none') o.secure = true;
              if (o.secure === undefined) o.secure = true;
            }
            o.httpOnly = true;

            redirectRes.headers.append('set-cookie', serialize(name, value, o));
          }
        },
      },
      cookieEncoding: 'base64url',
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(nextPath)}`, originOf(req))
    );
  }

  return redirectRes;
}
