import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing job ID' });

  const { data, error } = await supabase
    .from('regeneration_queue')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Job not found' });

  const { domain, template_id, city, state } = data;

  const insert = await supabase.from('regeneration_queue').insert([
    { domain, template_id, city, state, status: 'queued' }
  ]).select();

  if (insert.error) return res.status(500).json({ error: insert.error.message });

  res.status(200).json({ message: 'Retried', id: insert.data?.[0]?.id });
}
