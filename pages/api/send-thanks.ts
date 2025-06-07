import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const { recipient_id, block_id, message } = req.body;

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user || !recipient_id || !block_id || !message) return res.status(400).json({ error: 'Missing fields' });

  const { error } = await supabase.from('thank_you_notes').insert({
    sender_id: user.id,
    recipient_id,
    block_id,
    message
  });

  if (error) return res.status(500).json({ error });

  res.status(200).json({ success: true });
}
