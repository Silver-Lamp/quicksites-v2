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
  const { handle } = _req.query;
  if (!handle) return json({ error: 'Missing handle' });

  const { data, error } = await supabase
    .from('public_profiles')
    .select('*')
    .eq('handle', handle)
    .single();

  if (error) return json({ error: 'Not found' });

  json(data);
}
