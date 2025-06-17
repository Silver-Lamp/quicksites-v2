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
  const { slug } = req.query;
  if (!slug) return json({ error: 'Missing slug' });

  const { data, error } = await supabase.rpc('daily_checkins_by_slug', {
    slug,
  });

  if (error) return json({ error });

  json(data);
}
