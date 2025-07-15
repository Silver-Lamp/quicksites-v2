// lib/supabase/server.ts
'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { getServerSupabaseClient } from './serverClient';

export async function getSupabase(): Promise<SupabaseClient<Database>> {
  return getServerSupabaseClient();
}

export async function getUserFromRequest(): Promise<{
  user: Awaited<ReturnType<SupabaseClient<Database>['auth']['getUser']>>['data']['user'];
  supabase: SupabaseClient<Database>;
}> {
  const supabase = getServerSupabaseClient();
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
