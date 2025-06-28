import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from './types/supabase';

/**
 * Middleware to protect /admin/* routes.
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name, value, options) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name) {
          res.cookies.set(name, '', { maxAge: 0 });
        },
      },
    }
  );

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  const user = session?.user;

  console.log('🔐 [middleware] Session user:', user?.email || 'none');
  if (error) console.warn('⚠️ [middleware] Session error:', error.message);

  if (!user) {
    console.log('🔐 [middleware] Redirecting to login (Reason: No user)');
    return NextResponse.redirect(new URL('/login?error=unauthorized', req.url));
  }

  // Optionally attach role info or headers
  // res.headers.set('x-user-role', session.user.role ?? 'authenticated');

  return res; // ✅ Return modified response to apply any Set-Cookie headers
}

export const config = {
  matcher: ['/admin/:path*'],
};
