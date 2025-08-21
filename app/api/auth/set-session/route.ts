// app/api/auth/set-session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { access_token, refresh_token } = await req.json().catch(() => ({}));

  if (!access_token || !refresh_token) {
    return NextResponse.json({ ok: false, error: 'missing_tokens' }, { status: 400 });
  }

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

  // Set the session using the tokens from the fragment
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}
