import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const { slug, headline, goal_count, target_action, block_id } = req.body;

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { error } = await supabase.from('support_campaigns').insert({
    slug,
    headline,
    goal_count,
    target_action,
    block_id,
    created_by: user.id
  });

  if (error) return res.status(500).json({ error: error.message });

  res.status(200).json({ success: true });
}
