import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  const { slug, headline, goal_count, target_action, block_id } = _req.body;
  if (!slug) return json({ error: 'Missing slug' });

  const { error } = await supabase
    .from('support_campaigns')
    .update({ headline, goal_count, target_action, block_id })
    .eq('slug', slug);

  if (error) return json({ error: error.message });

  json({ success: true });
}
