import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
