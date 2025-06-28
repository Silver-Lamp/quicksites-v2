// lib/supabase/getSupabaseContext.ts
// Use getSessionContext() when you need user + role
// Use getSupabaseContext() when you just want the scoped client + headers/cookies
'use server';

import type { BaseContext } from './getBaseContext';
import { getBaseContext } from './getBaseContext';

export function getSupabaseContext(): BaseContext {
  return getBaseContext();
}
