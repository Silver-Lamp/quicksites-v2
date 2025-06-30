// app/api/logout/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';
import { safeParse } from '@/lib/utils/safeParse';

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ success: true });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => {
          const raw = req.cookies.get(name)?.value;
          if (!raw) return null;
          if (name.startsWith('sb-')) return raw;
          return safeParse(raw);
        },
        set: (name, value, options) => {
          const encoded = typeof value === 'string' ? value : JSON.stringify(value);
          res.cookies.set(name, encoded, options);
        },
        remove: (name) => {
          res.cookies.set(name, '', { maxAge: 0 });
        },
      },
    }
  );

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('[❌ Logout Error]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return res;
}
