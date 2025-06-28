// Use logBrandingEvent() when you need to log a branding event
// Use getUserFromRequest() when you need the user context

import { supabase } from '@/admin/lib/supabaseClient';

export async function logBrandingEvent(
  profileId: string,
  event: string,
  details: string = ''
): Promise<void> {
  try {
    const { data, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.warn('[logBrandingEvent] Auth error:', authError.message);
    }

    const userId = data?.user?.id ?? null;

    const { error: insertError } = await supabase.from('branding_logs').insert([
      {
        profile_id: profileId,
        user_id: userId,
        event,
        details,
      },
    ]);

    if (insertError) {
      console.error('[logBrandingEvent] Insert failed:', insertError.message);
    }
  } catch (err: any) {
    console.error('[logBrandingEvent] Unexpected error:', err.message || err);
  }
}
