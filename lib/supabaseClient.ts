// lib/supabaseClient.ts
import { createBrowserClient } from '@supabase/ssr'; // or createClient for classic
import { Database } from '@/types/supabase';

export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
