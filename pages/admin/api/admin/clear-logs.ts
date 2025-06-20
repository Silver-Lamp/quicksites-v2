// pages/api/admin/clear-logs.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { json } from '@/lib/api/json';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return json({ error: 'Missing auth token' });

  const { data: user, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user?.user) return json({ error: 'Unauthorized' });

  const role = user.user.user_metadata?.role;
  if (!['admin', 'owner'].includes(role)) return json({ error: 'Forbidden' });

  const { error } = await supabase.from('log_events').delete().neq('id', '');
  if (error) return json({ error: error.message });

  return json({ success: true });
}
