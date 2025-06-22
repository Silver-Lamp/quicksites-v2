export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { getBadgeForReferrals } from '@/lib/getBadgeForReferrer';
import { json } from '@/lib/api/json';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');

  if (!email) {
    return json({ error: 'Missing email' }, { status: 400 });
  }

  const { data: logs, count } = await supabase
    .from('referral_logs')
    .select('*', { count: 'exact', head: false }) // explicitly return count
    .eq('ref', email);

  const { data: user } = await supabase
    .from('users')
    .select('user_metadata')
    .eq('email', email)
    .maybeSingle();

  const badge = getBadgeForReferrals(count ?? 0);

  return json({
    count: count ?? 0,
    avatar: user?.user_metadata?.avatar_url || '',
    bio: user?.user_metadata?.bio || '',
    badge,
  });
}
