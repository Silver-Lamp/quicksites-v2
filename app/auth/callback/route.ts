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
const isLocal = (req: NextRequest) => /(^|:)localhost(?::|$)|^127\.0\.0\.1(?::|$)/i
  .test(req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '');

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
  const nextAbs = new URL(nextPath, originOf(req)).toString();

  if (!code) {
    return NextResponse.redirect(new URL(`/login?error=missing_code&next=${encodeURIComponent(nextPath)}`, originOf(req)));
  }

  // We return a 200 HTML page that immediately client-redirects.
  const res = new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>Signing you in…</title>
     <meta http-equiv="refresh" content="0;url=${nextAbs}">
     <script>location.replace(${JSON.stringify(nextAbs)});</script>`,
    { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }
  );

  const local = isLocal(req);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => parseCookieHeader(req.headers.get('cookie')),
        setAll: (cookies) => {
          for (const { name, value, options } of cookies) {
            // 🚦 Normalize cookie attributes
            const o = { ...(options ?? {}) } as SerializeOptions;

            // Always use root path
            o.path = '/';

            // Never set Domain on localhost (Chrome rejects it)
            delete (o as any).domain;

            if (local) {
              // On localhost (http), force a valid combination:
              //   SameSite=Lax (NOT None) and Secure=false
              o.sameSite = 'lax';
              o.secure = false;
            } else {
              // In prod: if SameSite=None, Secure MUST be true
              const same = (o.sameSite ?? 'lax') as SerializeOptions['sameSite'];
              if ((same as any) === 'none') o.secure = true;
              if (o.secure === undefined) o.secure = true;
            }

            // HttpOnly for auth
            o.httpOnly = true;

            res.headers.append('set-cookie', serialize(name, value, o));
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

  return res;
}
