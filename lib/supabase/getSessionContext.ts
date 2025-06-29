'use server';

import { cookies, headers } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase';

type ExtendedUser = {
  id: string;
  email: string;
  avatar_url?: string | null;
};

export async function getSessionContext(): Promise<{
  user: ExtendedUser | null;
  role: string;
}> {
  const cookieStore = cookies(); // ✅ sync-safe per App Router
  const headerStore = headers();

  const supabase = createServerComponentClient<Database>({
    cookies: () => Promise.resolve(cookieStore), // ✅ makes Supabase happy
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.warn('[⚠️ getSessionContext] Supabase auth error:', authError.message);
  }

  let extendedUser: ExtendedUser | null = null;
  let role = 'viewer';

  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.warn('[⚠️ getSessionContext] Profile lookup failed:', profileError.message);
    }

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
    user: extendedUser,
    role,
  };
}
