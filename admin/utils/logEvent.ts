'use client';

import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
