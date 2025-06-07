import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const { preclaim_token } = req.body;

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user || !preclaim_token) return res.status(400).json({ error: 'Invalid request' });

  const { data: campaign, error } = await supabase
    .from('support_campaigns')
    .select('*')
    .eq('preclaim_token', preclaim_token)
    .maybeSingle();

  if (error || !campaign) return res.status(404).json({ error: 'Not found' });

  const { error: updateError } = await supabase
    .from('support_campaigns')
    .update({ created_by: user.id, preclaim_token: null })
    .eq('id', campaign.id);

  if (updateError) return res.status(500).json({ error: updateError.message });

  res.status(200).json({ success: true });
}
