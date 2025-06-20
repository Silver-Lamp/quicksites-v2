import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const token = _req.headers.authorization?.replace('Bearer ', '');
  const { block_id, message } = _req.body;

  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  if (!user || !block_id) return json({ error: 'Unauthorized' });

  const { error } = await supabase.from('block_feedback').insert({
    block_id,
    user_id: user.id,
    action: 'reflect',
    message: message || null,
  });

  if (error) return json({ error });

  json({ success: true });
}
