// admin/utils/logEvent.ts

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export async function logEvent(type: string, payload: Record<string, any>) {
  try {
    const supabase = createClientComponentClient();

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
