// lib/server/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,          // URL
  process.env.SUPABASE_SERVICE_ROLE_KEY!,         // ✅ service role key (never expose client-side)
  {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    db:   { schema: 'public' },                      // make 'app' the default schema
  }
);
