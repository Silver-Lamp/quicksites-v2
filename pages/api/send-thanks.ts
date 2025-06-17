import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  const token = _req.headers.authorization?.replace('Bearer ', '');
  const { recipient_id, block_id, message } = _req.body;

  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user || !recipient_id || !block_id || !message)
    return json({ error: 'Missing fields' });

  const { error } = await supabase.from('thank_you_notes').insert({
    sender_id: user.id,
    recipient_id,
    block_id,
    message,
  });

  if (error) return json({ error });

  json({ success: true });
}
