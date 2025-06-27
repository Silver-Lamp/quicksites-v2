'use server';

if (typeof window !== 'undefined') {
  throw new Error('[💥 server.ts] This file should not be imported client-side.');
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { createScopedSupabaseClient } from './createScopedClient';

/**
 * Returns a Supabase client with access to server-side cookies.
 */
export async function getSupabase(): Promise<SupabaseClient<Database>> {
  return createScopedSupabaseClient();
}

/**
 * Gets the authenticated user from the current request context (or null).
 */
export async function getUserFromRequest(): Promise<{
  user: Awaited<ReturnType<SupabaseClient<Database>['auth']['getUser']>>['data']['user'];
  supabase: SupabaseClient<Database>;
}> {
  const supabase = await getSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    console.warn('[⚠️ getUserFromRequest] No valid session:', error?.message);
    return { user: null, supabase };
  }

  return { user, supabase };
}
