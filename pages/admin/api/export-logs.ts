import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(_: NextApiRequest, res: NextApiResponse) {
  const { data, error } = await supabase
    .from('regeneration_queue')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.setHeader('Content-Disposition', 'attachment; filename="regeneration_logs.json"');
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json(data);
}
