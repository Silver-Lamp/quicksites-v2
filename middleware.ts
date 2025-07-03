import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from './types/supabase';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user;

  if (user) {
    console.log('[middleware] user:', user?.email);

    // 🔍 Fetch role from your app DB (user_profiles or user_roles)
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    console.log('[middleware] role:', profile?.role);

    const resolvedRole = profile?.role || 'guest';

    console.log('[middleware] resolvedRole:', resolvedRole);

    // 🔁 Inject headers
    res.headers.set('x-user-id', user.id);
    res.headers.set('x-user-email', user.email ?? '');
    res.headers.set('x-user-role', resolvedRole); // ✅ Use role from DB
    res.headers.set('x-user-name', user.user_metadata?.name ?? '');
    res.headers.set('x-user-avatar-url', user.user_metadata?.avatar_url ?? '');
  }

  return res;
}

export const config = {
  matcher: ['/admin/:path*', '/login'],
};
