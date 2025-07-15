// lib/supabase/serverClient.ts
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';

export function getServerSupabaseClient() {
  return createServerComponentClient<Database>({ cookies });
}
