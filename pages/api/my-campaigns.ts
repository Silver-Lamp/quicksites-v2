import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { user_id } = req.query;
  if (!user_id) return json({ error: 'Missing user_id' });

  const { data, error } = await supabase
    .from('support_campaigns')
    .select('*')
    .eq('created_by', user_id)
    .order('created_at', { ascending: false });

  if (error) return json({ error });

  json(data);
}
