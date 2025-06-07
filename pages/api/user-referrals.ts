import { createClient } from '@supabase/supabase-js';
import { getBadgeForReferrals } from '@/lib/getBadgeForReferrer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  const { email } = req.query;

  const { data: logs, count } = await supabase
    .from('referral_logs')
    .select('*', { count: 'exact' })
    .eq('ref', email);

  const { data: user } = await supabase
    .from('users')
    .select('user_metadata')
    .eq('email', email)
    .single();

  const badge = getBadgeForReferrals(count ?? 0);

  res.status(200).json({
    count: count ?? 0,
    avatar: user?.user_metadata?.avatar_url || '',
    bio: user?.user_metadata?.bio || '',
    badge
  });
}
