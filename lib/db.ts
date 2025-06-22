// lib/db.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase.ts';

// Load environment variables only in non-production environments
if (process.env.NODE_ENV !== 'production') {
  const dotenv = await import('dotenv');
  dotenv.config();
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase env vars: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

// Fully typed Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
