import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const cookieStore = cookies(); // auto-provided by App Router
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          const cookie = await cookieStore;
          return cookie.get(name)?.value;
        },
        async set(name: string, value: string, options) {
          const cookie = await cookieStore;
          cookie.set({ name, value, ...options });
        },
        async remove(name: string) {
          const cookie = await cookieStore;
          cookie.set({ name, value: '', maxAge: 0 });
        },
      },
    }
  );

  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('[❌ Logout Error]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response = NextResponse.redirect(new URL('/login?logout=success', req.url));

  // 🔐 Ensure tokens are removed client-side as well
  response.cookies.set('sb-access-token', '', { maxAge: 0 });
  response.cookies.set('sb-refresh-token', '', { maxAge: 0 });

  return response;
}
