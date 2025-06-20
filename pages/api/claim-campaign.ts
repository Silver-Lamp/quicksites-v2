import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const { preclaim_token } = req.body;

  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user || !preclaim_token) return json({ error: 'Invalid request' });

  const { data: campaign, error } = await supabase
    .from('support_campaigns')
    .select('*')
    .eq('preclaim_token', preclaim_token)
    .maybeSingle();

  if (error || !campaign) return json({ error: 'Not found' });

  const { error: updateError } = await supabase
    .from('support_campaigns')
    .update({ created_by: user.id, preclaim_token: null })
    .eq('id', campaign.id);

  if (updateError) return json({ error: updateError.message });

  json({ success: true });
}
