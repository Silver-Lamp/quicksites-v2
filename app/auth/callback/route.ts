// app/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeNext(n?: string | null) {
  return n && n.startsWith('/') ? n : '/';
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));

  // Case A: PKCE / code exchange (e.g., OAuth)
  if (code) {
    const store = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return store.get(name)?.value; },
          set(name: string, value: string, options: any) { store.set({ name, value, ...options }); },
          remove(name: string, options: any) { store.set({ name, value: '', ...options, maxAge: 0 }); },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=callback&msg=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`, url.origin)
      );
    }
    return NextResponse.redirect(new URL(next, url.origin));
  }

  // Case B: Magic link (tokens are in the fragment; server can't see them).
  // Return a tiny HTML page that:
  //  1) reads tokens from location.hash
  //  2) POSTs them to an API route that sets the server cookies
  //  3) redirects to `next`
  const finalizeUrl = new URL('/api/auth/set-session', url.origin).toString();
  const dest = new URL(next, url.origin).toString();

  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>Completing sign-in…</title>
     <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica,Arial,sans-serif;color:#eee;background:#111;margin:40px}</style>
     <p>Completing sign-in…</p>
     <script>
      (function(){
        var h = new URLSearchParams(location.hash.replace(/^#/, ''));
        var at = h.get('access_token');
        var rt = h.get('refresh_token');
        if (!at || !rt) {
          location.replace(${JSON.stringify('/login?error=missing_tokens')});
          return;
        }
        fetch(${JSON.stringify(finalizeUrl)}, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ access_token: at, refresh_token: rt })
        }).then(function(r){ return r.json(); })
          .then(function(){ location.replace(${JSON.stringify(dest)}); })
          .catch(function(){ location.replace(${JSON.stringify('/login?error=cookie_set_failed')}); });
      })();
     </script>`,
    { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
  );
}
