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
  const { data, error } = await supabase
    .from('public_profiles')
    .select('*')
    .eq('visible', true)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) return json({ error });

  json(data);
}
