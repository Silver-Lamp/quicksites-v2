import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { blockId } = JSON.parse(req.body || '{}');
  const auth = req.headers.authorization?.replace('Bearer ', '');
  const {
    data: { user }
  } = await supabase.auth.getUser(auth);

  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { data: block } = await supabase
    .from('blocks')
    .select('*')
    .eq('id', blockId)
    .single();

  if (!block) return res.status(404).json({ error: 'Block not found' });

  const { error } = await supabase
    .from('blocks')
    .insert({
      owner_id: user.id,
      title: block.title,
      message: block.message,
      lat: block.lat,
      lon: block.lon,
      emoji: block.emoji,
      image_url: block.image_url
    });

  if (error) return res.status(500).json({ error });

  res.status(200).json({ success: true });
}
