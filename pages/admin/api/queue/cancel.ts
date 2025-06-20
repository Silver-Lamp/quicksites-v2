import type { NextApiRequest, NextApiResponse } from 'next';
import { json } from '@/lib/api/json';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.body;
  if (!id) return json({ error: 'Missing job ID' });

  const { error } = await supabase
    .from('regeneration_queue')
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (error) return json({ error: error.message });

  json({ message: 'Cancelled' });
}
