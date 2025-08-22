// lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js';
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    global: {
      fetch: (input, init: any = {}) =>
        fetch(input as any, { ...init, cache: 'no-store', next: { revalidate: 0 } }),
      headers: { 'x-qs-srv': 'admin' },
    },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }
);
