'use client';

import { supabase } from '@/lib/supabase/client';

/**
 * Logs a user or system event to Supabase.
 * Reuses the singleton Supabase client to avoid duplication warnings.
 */
export async function logEvent(type: string, payload: Record<string, any>) {
  try {
    await supabase.from('site_events').insert([
      {
        type,
        payload,
      },
    ]);
  } catch (err) {
    console.error('❌ Failed to log event:', err);
  }
}
