import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'Missing lat/lon' });

  const radius = 0.01; // ~1km neighborhood
  const { data, error } = await supabase
    .from('blocks')
    .select('*')
    .gte('lat', parseFloat(lat) - radius)
    .lte('lat', parseFloat(lat) + radius)
    .gte('lon', parseFloat(lon) - radius)
    .lte('lon', parseFloat(lon) + radius)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error });
  res.status(200).json(data);
}
