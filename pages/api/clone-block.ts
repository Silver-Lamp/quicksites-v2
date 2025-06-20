import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { blockId } = JSON.parse(req.body || '{}');
  const auth = req.headers.authorization?.replace('Bearer ', '');
  const {
    data: { user },
  } = await supabase.auth.getUser(auth);

  if (!user) return json({ error: 'Unauthorized' });

  const { data: block } = await supabase.from('blocks').select('*').eq('id', blockId).single();

  if (!block) return json({ error: 'Block not found' });

  const { error } = await supabase.from('blocks').insert({
    owner_id: user.id,
    title: block.title,
    message: block.message,
    lat: block.lat,
    lon: block.lon,
    emoji: block.emoji,
    image_url: block.image_url,
  });

  if (error) return json({ error });

  json({ success: true });
}
