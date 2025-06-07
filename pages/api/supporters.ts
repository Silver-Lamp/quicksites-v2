import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  const { handle } = req.query;
  if (!handle) return res.status(400).json({ error: 'Missing handle' });

  const { data: blocks } = await supabase
    .from('blocks')
    .select('id')
    .eq('owner_handle', handle);

  const blockIds = blocks?.map(b => b.id) || [];

  const { data: feedback, error } = await supabase
    .from('block_feedback')
    .select('user_id, action, created_at')
    .in('block_id', blockIds);

  if (error) return res.status(500).json({ error });

  const supporters = feedback.reduce((acc, item) => {
    if (!acc[item.user_id]) acc[item.user_id] = { cheer: 0, echo: 0, reflect: 0 };
    acc[item.user_id][item.action]++;
    return acc;
  }, {});

  res.status(200).json(Object.entries(supporters).map(([uid, counts]) => ({
    user_id: uid,
    ...counts
  })));
}
