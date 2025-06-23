// lib/supabase/universal.ts
import { createServerClient } from '@supabase/ssr';
import { cookies as nextCookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function getSupabase(context?: { req?: Request }): Promise<SupabaseClient> {
  const isApiRoute = context?.req instanceof Request;

  if (isApiRoute) {
    const req = context.req!;
    const cookieHeader = req.headers.get('cookie') || '';
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            const match = cookieHeader
              .split(';')
              .map((c) => c.trim())
              .find((c) => c.startsWith(`${name}=`));
            return match?.split('=')[1] ?? undefined;
          },
          set() {},
          remove() {},
        },
      }
    );
  }

  const cookieStore = await nextCookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}
