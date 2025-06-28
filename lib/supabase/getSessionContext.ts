'use server';

import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

type ExtendedUser = {
  id: string;
  email: string;
  avatar_url?: string | null;
};

export async function getSessionContext(): Promise<{
  user: ExtendedUser | null;
  role: string;
  headers: Headers;
  cookies: ReturnType<typeof cookies>;
  ip: string;
  userAgent: string;
  supabase: ReturnType<typeof createServerClient<Database>>;
}> {
  const cookieStore = cookies();  // ReadonlyRequestCookies
  const headerStore = headers();  // ReadonlyHeaders

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          const cookie = await cookieStore;
          return cookie.get(name)?.value;
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let extendedUser: ExtendedUser | null = null;
  let role: string = 'viewer';

  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle();

    extendedUser = {
      id: user.id,
      email: user.email ?? '',
      avatar_url: profile?.avatar_url ?? null,
    };

    if (profile?.role) {
      role = profile.role;
    }
  }

  const ip =
    (await headerStore).get('x-forwarded-for')?.split(',')[0]?.trim() ||
    (await headerStore).get('x-real-ip') ||
    'unknown';

  const userAgent = (await headerStore).get('user-agent') || 'unknown';

  return {
    user: extendedUser,
    role,
    headers: await headerStore,
    cookies: cookieStore,
    ip,
    userAgent,
    supabase,
  };
}
