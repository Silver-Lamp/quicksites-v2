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
  const { tags } = req.query;
  if (!tags || typeof tags !== 'string')
    return json({ error: 'Missing or invalid tags' });

  const tagArray = tags.split(',').map((t: string) => t.trim());

  const { data, error } = await supabase
    .from('public_profiles')
    .select('*')
    .contains('goal_tags', tagArray)
    .eq('visible', true)
    .limit(50);

  if (error) return json({ error });

  json(data);
}
