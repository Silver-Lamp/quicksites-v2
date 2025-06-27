'use server';

import { getSupabase } from '../server';

export async function getServerUserProfile(): Promise<{
  role: string;
  email: string | null;
  isAnonymous: boolean;
} | null> {
  const supabase = await getSupabase();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.id) {
    console.warn('[getServerUserProfile] No logged-in user — returning fallback role');
    return {
      role: 'viewer',
      email: null,
      isAnonymous: true,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role, email')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    console.warn('[getServerUserProfile] Profile missing or error — using default role');
    return {
      role: 'viewer',
      email: user.email ?? null,
      isAnonymous: false,
    };
  }

  return {
    role: profile.role ?? 'viewer',
    email: profile.email ?? user.email ?? null,
    isAnonymous: false,
  };
}
