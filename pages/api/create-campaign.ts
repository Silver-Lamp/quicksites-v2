import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const { slug, headline, goal_count, target_action, block_id } = req.body;

  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return json({ error: 'Unauthorized' });

  const { error } = await supabase.from('support_campaigns').insert({
    slug,
    headline,
    goal_count,
    target_action,
    block_id,
    created_by: user.id,
  });

  if (error) return json({ error: error.message });

  json({ success: true });
}
