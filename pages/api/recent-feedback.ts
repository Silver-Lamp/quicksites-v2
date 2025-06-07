import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  const { block_id, action } = req.query;
  if (!block_id || !action) return res.status(400).json({ error: 'Missing block_id or action' });

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { count, error } = await supabase
    .from('block_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('block_id', block_id)
    .eq('action', action)
    .gt('created_at', oneWeekAgo.toISOString());

  if (error) return res.status(500).json({ error: error.message });

  res.status(200).json({ count });
}
