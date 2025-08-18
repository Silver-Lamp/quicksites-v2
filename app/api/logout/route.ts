export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });

  const cookiesAdapter = {
    get: (name: string) => req.cookies.get(name)?.value,
    set: (name: string, value: string, options?: any) => res.cookies.set(name, value, options),
    remove: (name: string, options?: any) =>
      res.cookies.set(name, '', { path: '/', maxAge: 0, ...options }),
  } as unknown as CookieMethodsServer;

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookiesAdapter, cookieEncoding: 'base64url' }
  );

  await supabase.auth.signOut();
  return res;
}
