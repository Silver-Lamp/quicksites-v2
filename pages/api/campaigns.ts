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
    .from('support_campaigns')
    .select('slug, headline, goal_count, target_action, created_at')
    .order('created_at', { ascending: false });

  if (error) return json({ error });

  json(data);
}
