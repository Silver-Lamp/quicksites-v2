// lib/supabase/server/getServerUserProfile.ts
// Use getServerUserProfile() when you need to get the user context
// Use getSupabase() when you need the scoped client
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
    console.warn('[getServerUserProfile] No user found — defaulting to viewer');
    return {
      role: 'viewer',
      email: null,
      isAnonymous: true,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) {
    console.warn('[getServerUserProfile] Profile lookup failed:', profileError.message);
  }

  return {
    role: profile?.role ?? 'viewer',
    email: user.email ?? null,
    isAnonymous: false,
  };
}
