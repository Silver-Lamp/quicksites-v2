// lib/supabase/getSupabase.ts
import 'server-only';
import { getServerSupabaseClient } from './serverClient';

export async function getSupabase() {
  // thin wrapper so call sites read nicer
  return getServerSupabaseClient();
}