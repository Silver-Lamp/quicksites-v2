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
  const { lead_id, domain_id, triggered_by } = req.body;
  if (!lead_id) return json({ error: 'Missing lead ID' });

  await supabase.from('user_action_logs').insert([
    {
      lead_id,
      domain_id,
      action_type: 'card_printed',
      triggered_by: triggered_by || 'unknown',
    },
  ]);

  return json({ message: 'Print log saved' });
}
