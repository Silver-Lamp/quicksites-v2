import type { NextApiRequest, NextApiResponse } from 'next';
import { json } from '@/lib/api/json';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' });
  }

  const { token } = req.body;

  if (!token) {
    return json({ error: 'Missing token' });
  }

  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('unsubscribe_token', token);

  if (error) return json({ error: error.message });

  json({ success: true });
}
