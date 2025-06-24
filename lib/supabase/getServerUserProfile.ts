// lib/supabase/getServerUserProfile.ts
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function getServerUserProfile() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { headers: { Authorization: (await cookies()).get('sb-access-token')?.value || '' } } }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const userId = session?.user?.id;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, email')
    .eq('user_id', userId)
    .maybeSingle();

  return profile;
}
