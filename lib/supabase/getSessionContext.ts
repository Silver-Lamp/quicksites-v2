// lib/supabase/getSessionContext.ts
// Use getSessionContext() when you need user + role
// Use getSupabaseContext() when you just want the scoped client + headers/cookies
'use server';

import type { BaseContext } from './getBaseContext';
import { getBaseContext } from './getBaseContext';

type ExtendedUser = {
  id: string;
  email: string;
  avatar_url?: string | null;
};

export async function getSessionContext(): Promise<
  BaseContext & {
    user: ExtendedUser | null;
    role: string;
  }
> {
  const base = await getBaseContext();
  const {
    supabase,
    cookies: cookieStore,
    headers: headerStore,
    ip,
    userAgent,
  } = base;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let extendedUser: ExtendedUser | null = null;
  let role = 'viewer';

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

  return {
    ...base,
    user: extendedUser,
    role,
  };
}
