// admin/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase'; // ✅ use shared types

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
