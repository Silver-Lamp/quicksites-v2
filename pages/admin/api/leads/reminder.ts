import type { NextApiRequest, NextApiResponse } from 'next';
import { json } from '@/lib/api/json';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { lead, triggered_by } = req.body;

  if (!lead?.email) return json({ error: 'Missing lead email' });

  console.log(`📨 Sending reminder email to: ${lead.email}`);

  await supabase.from('user_action_logs').insert([
    {
      lead_id: lead.id,
      domain_id: lead.domain_id,
      action_type: 'reminder_sent',
      triggered_by: triggered_by || 'unknown',
    },
  ]);

  return json({ message: 'Reminder logged and sent (mock)' });
}
