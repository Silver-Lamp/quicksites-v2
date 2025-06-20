import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { title, message, lat, lon, emoji } = JSON.parse(req.body || '{}');
  if (!lat || !lon || !title) return json({ error: 'Missing fields' });

  const {
    data: { user },
  } = await supabase.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));

  if (!user) return json({ error: 'Unauthorized' });

  const { data, error } = await supabase.from('blocks').insert({
    owner_id: req.headers['x-user-id'] || '00000000-0000-0000-0000-000000000000',
    title,
    message,
    lat,
    lon,
    emoji,
  });

  if (error) return json({ error });
  json({ success: true, data });
}
