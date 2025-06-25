'use server';

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export async function getSupabase(): Promise<SupabaseClient<Database>> {
  if (typeof window !== 'undefined') {
    throw new Error('[getSupabase] ❌ This function must not be called on the client.');
  }

  return createServerComponentClient<Database>({
    cookies: async () => cookies(),
  });
}

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
