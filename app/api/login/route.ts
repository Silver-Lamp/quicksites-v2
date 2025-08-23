import { headers, cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeNext(n?: string | null) {
  return n && n.startsWith('/') ? n : '/admin/tools';
}

function detectOrigin(h: Headers) {
  const xfHost  = h.get('x-forwarded-host')?.split(',')[0]?.trim();
  const xfProto = h.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const host    = (xfHost || h.get('host') || '').trim();
  const referer = h.get('referer') || '';

  const localOverride = process.env.NEXT_PUBLIC_LOCAL_URL?.trim(); // e.g. http://localhost:3000
  const siteOverride  = process.env.NEXT_PUBLIC_SITE_URL?.trim();  // e.g. https://www.quicksites.ai

  const isLocal = /^localhost(:\d+)?$|^127\.0\.0\.1(:\d+)?$/i.test(host);
  const proto   = xfProto || (isLocal ? 'http' : 'https');

  if (host) {
    const built = `${proto}://${host}`;
    return isLocal && localOverride ? localOverride : built;
  }
  try {
    if (referer) { const u = new URL(referer); return `${u.protocol}//${u.host}`; }
  } catch {}
  return process.env.NODE_ENV !== 'production'
    ? (localOverride || 'http://localhost:3000')
    : (siteOverride  || 'https://www.quicksites.ai');
}

export async function POST(req: Request) {
  try {
    const { email, next } = (await req.json()) as { email: string; next?: string };

    // ✅ Next 15: await headers() and cookies()
    const h = await headers();
    const origin = detectOrigin(h);
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`;

    const store = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string)                 { return store.get(name)?.value; },
          set(name: string, value: string, options: any) { store.set({ name, value, ...options }); },
          remove(name: string, options: any)             { store.set({ name, value: '', ...options, maxAge: 0 }); },
        },
        cookieEncoding: 'base64url',
      }
    );

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,           // ← forces localhost in dev
        shouldCreateUser: true,
        data: { requested_redirect: redirectTo }, // debug aid
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message, origin, redirect: redirectTo }, { status: 400 });
    }
    return NextResponse.json({ ok: true, origin, redirect: redirectTo });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'login error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, error: 'Use POST', hint: 'POST /api/login' }, { status: 405 });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
