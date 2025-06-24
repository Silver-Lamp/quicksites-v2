// lib/supabase/server.ts
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Fetch a user's canonical role from the user_profiles table using an access token.
 */
export async function fetchUserByAccessToken(token: string): Promise<string | null> {
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      console.error('[🔒 fetchUserByAccessToken] Failed to get user from token:', error?.message);
      return null;
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[🔒 fetchUserByAccessToken] Failed to get profile:', profileError.message);
      return null;
    }

    return profile?.role ?? null;
  } catch (err) {
    console.error('[🔒 fetchUserByAccessToken] Unexpected error:', err);
    return null;
  }
}
