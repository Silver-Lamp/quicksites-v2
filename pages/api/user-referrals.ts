import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { getBadgeForReferrals } from '@/lib/getBadgeForReferrer';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  const { email } = _req.query;

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

  json({
    count: count ?? 0,
    avatar: user?.user_metadata?.avatar_url || '',
    bio: user?.user_metadata?.bio || '',
    badge,
  });
}
