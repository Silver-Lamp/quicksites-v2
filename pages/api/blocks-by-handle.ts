import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { handle } = req.query;
  if (!handle) return json({ error: 'Missing handle' });

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('user_metadata->>handle', handle)
    .single();

  if (!user) return json({ error: 'User not found' });

  const { data, error } = await supabase
    .from('blocks')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return json({ error });

  json(data);
}
