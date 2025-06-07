import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  const { user_id, type } = req.query;
  if (!user_id || !type) return res.status(400).json({ error: 'Missing parameters' });

  const column = type === 'sent' ? 'user_id' : 'receiver_id';
  const matchColumn = type === 'sent' ? 'user_id' : 'block_id';

  const { data, error } = await supabase
    .from('block_feedback')
    .select('*')
    .eq(type === 'sent' ? 'user_id' : 'block_owner_id', user_id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error });

  res.status(200).json(data);
}
