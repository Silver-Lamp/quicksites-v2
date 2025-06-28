// lib/supabase/server.ts
// Use getSupabase() when you need the scoped client
// Use getUserFromRequest() when you need the user context
'use server';

if (typeof window !== 'undefined') {
  throw new Error('[❌ server.ts] This file must not run on the client.');
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { createScopedSupabaseClient } from './createScopedClient';

/**
 * Provides the scoped Supabase client.
 */
export async function getSupabase(): Promise<SupabaseClient<Database>> {
  return createScopedSupabaseClient();
}

/**
 * Fetches the currently authenticated user from cookies.
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
