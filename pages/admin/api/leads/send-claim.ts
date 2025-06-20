import type { NextApiRequest, NextApiResponse } from 'next';
import { json } from '@/lib/api/json';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { lead } = req.body;
  if (!lead?.email || !lead?.business_name) {
    return json({ error: 'Missing lead data' });
  }

  const domain = lead?.domains?.domain || 'example.com';
  const claimUrl = `https://${domain}`;

  console.log(`📧 MOCK CLAIM EMAIL TO: ${lead.email}`);
  console.log(`Subject: Your Website Is Ready`);
  console.log(`Body: Hey ${lead.business_name}, you can preview your new site at ${claimUrl}`);

  await supabase.from('user_action_logs').insert([
    {
      lead_id: lead.id,
      domain_id: lead.domain_id,
      action_type: 'claim_email_sent',
      triggered_by: 'system',
    },
  ]);

  return json({ message: 'Claim email sent (mock)' });
}
