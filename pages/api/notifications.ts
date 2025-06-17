import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { handle } = req.query;
  if (!handle) return json({ error: 'Missing handle' });

  const { data, error } = await supabase
    .from('support_requests')
    .select('*')
    .eq('receiver_handle', handle)
    .order('created_at', { ascending: false });

  if (error) return json({ error });

  json(data);
}
