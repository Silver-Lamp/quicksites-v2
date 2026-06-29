// lib/auth/adminUser.ts
//
// Resolve the current request's admin user id (or null). Admin = a row in
// admin_users OR user_profiles.role in ('admin','owner') — matching useIsAdmin.
// For use in admin-gated route handlers.

import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function adminUserId(): Promise<string | null> {
  const store = await cookies();
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
        setAll: (cks) => cks.forEach((c) => store.set(c.name, c.value, c.options as CookieOptions | undefined)),
      },
    }
  );

  const { data: auth } = await (supa as any).auth.getUser();
  const user = auth?.user;
  if (!user) return null;

  const { data: au } = await (supa as any)
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .limit(1);
  if (au?.[0]) return user.id;

  const { data: prof } = await (supa as any)
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (prof && (prof.role === 'admin' || prof.role === 'owner')) return user.id;

  return null;
}
