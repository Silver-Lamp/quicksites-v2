import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { lat, lon } = req.query;
  if (!lat || !lon) return json({ error: 'Missing lat/lon' });

  const radius = 0.01; // ~1km neighborhood
  const { data, error } = await supabase
    .from('blocks')
    .select('*')
    .gte('lat', parseFloat(Array.isArray(lat) ? lat[0] : lat) - radius)
    .lte('lat', parseFloat(Array.isArray(lat) ? lat[0] : lat) + radius)
    .gte('lon', parseFloat(Array.isArray(lon) ? lon[0] : lon) - radius)
    .lte('lon', parseFloat(Array.isArray(lon) ? lon[0] : lon) + radius)
    .order('created_at', { ascending: false });

  if (error) return json({ error });
  json(data);
}
