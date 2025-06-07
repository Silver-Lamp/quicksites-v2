import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { title, message, lat, lon, emoji } = JSON.parse(req.body || '{}');
  if (!lat || !lon || !title) return res.status(400).json({ error: 'Missing fields' });

  const { data, error } = await supabase
    .from('blocks')
    .insert({
      owner_id: req.headers['x-user-id'] || '00000000-0000-0000-0000-000000000000',
      title, message, lat, lon, emoji
    });

  if (error) return res.status(500).json({ error });
  res.status(200).json({ success: true, data });
}
