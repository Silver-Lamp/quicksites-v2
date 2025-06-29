// lib/supabase/getSupabase.ts
'use server';

import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '../../types/supabase';

export function getSupabase() {
  const cookieStore = cookies(); // ✅ sync-safe call in App Router
  const supabase = createServerComponentClient<Database>({
    cookies: () => cookieStore,
  });

  return supabase;
}
