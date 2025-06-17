import type { NextApiRequest, NextApiResponse } from 'next';
import { json } from '@/lib/api/json';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.body;
  if (!id) return json({ error: 'Missing job ID' });

  const { data, error } = await supabase
    .from('regeneration_queue')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return json({ error: 'Job not found' });

  const { domain, template_id, city, state } = data;

  const insert = await supabase
    .from('regeneration_queue')
    .insert([{ domain, template_id, city, state, status: 'queued' }])
    .select();

  if (insert.error) return json({ error: insert.error.message });

  json({ message: 'Retried', id: insert.data?.[0]?.id });
}
