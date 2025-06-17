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
  const { block_id, action } = _req.query;
  if (!block_id || !action)
    return json({ error: 'Missing block_id or action' });

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { count, error } = await supabase
    .from('block_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('block_id', block_id)
    .eq('action', action)
    .gt('created_at', oneWeekAgo.toISOString());

  if (error) return json({ error: error.message });

  json({ count });
}
