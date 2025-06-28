import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareSupabaseClient } from '@/lib/supabase/middlewareClient';

const DEBUG = process.env.DEBUG_AUTH === 'true';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareSupabaseClient(req);

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  const user = session?.user;

  if (DEBUG) {
    console.log('🔐 [middleware] Session user:', user?.email || 'none');
    if (sessionError) console.warn('⚠️ [middleware] Session error:', sessionError.message);
  }

  if (!user) {
    return NextResponse.redirect(new URL('/login?error=unauthorized', req.url));
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  const role = profile?.role ?? 'unknown';

  if (DEBUG) {
    console.log('📄 [middleware] Role:', role);
    if (profileError) console.warn('❌ [middleware] Role error:', profileError.message);
  }

  // 🔐 Role check (customize as needed)
  const allowedRoles = ['admin', 'owner', 'reseller'];
  if (!allowedRoles.includes(role)) {
    return NextResponse.redirect(new URL('/login?error=forbidden', req.url));
  }

  // ✅ Attach role to response header for debugging or downstream context
  res.headers.set('x-user-role', role);

  return res;
}

export const config = {
  matcher: ['/admin/:path*'], // Only protect /admin/ routes
};
