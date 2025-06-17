import { supabase } from '@/admin/lib/supabaseClient';

export async function logBrandingEvent(
  profileId: string,
  event: string,
  details: string = ''
) {
  const { data: user } = await supabase.auth.getUser();
  const userId = user?.user?.id || null;

  await supabase.from('branding_logs').insert([
    {
      profile_id: profileId,
      user_id: userId,
      event,
      details,
    },
  ]);
}
