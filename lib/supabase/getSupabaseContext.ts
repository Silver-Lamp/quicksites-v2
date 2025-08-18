// lib/supabase/getSupabaseContext.ts
import 'server-only';
import { getSupabaseRSC } from '@/lib/supabase/serverClient';

export async function getSupabaseContext() {
  // thin wrapper to keep call sites simple
  return getSupabaseRSC();
}
