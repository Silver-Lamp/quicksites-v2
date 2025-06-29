'use server';

import { getServerContext } from './getServerContext';

/**
 * Fetches the current user's session, role, and email.
 * Includes scoped cookies + headers for context-aware logging or analytics.
 */
export async function getServerUserProfile(): Promise<{
  user: {
    id: string;
    email: string | null;
  } | null;
  role: string;
  headers: Headers;
  cookies: ReturnType<Awaited<typeof import('next/headers')>['cookies']>;
}> {
  const { supabase, cookies, headers } = await getServerContext();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    console.warn('[getServerUserProfile] No valid session found.');
    return {
      user: null,
      role: 'viewer',
      headers: await headers,
      cookies: cookies,
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
    user: {
      id: user.id,
      email: user.email ?? null,
    },
    role: profile?.role ?? 'viewer',
    headers: await headers,
    cookies,
  };
}
