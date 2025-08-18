// lib/supabase/cookieAdapter.ts
import type { CookieMethodsServer, CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Build a CookieMethodsServer bound to a specific NextResponse.
 * Next 15 requires `await cookies()` in RSC/route handlers.
 */
export async function cookieAdapterFor(res: NextResponse): Promise<CookieMethodsServer> {
  const store = await cookies();

  const adapter: CookieMethodsServer = {
    getAll() {
      return store.getAll().map((c) => ({ name: c.name, value: c.value }));
    },
    setAll(entries) {
      for (const { name, value, options } of entries) {
        res.cookies.set({ name, value, ...(options as CookieOptions | undefined) });
      }
    },
  };

  return adapter;
}
