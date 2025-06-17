import type { NextApiRequest, NextApiResponse } from 'next';
import { json } from '@/lib/api/json';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAPBOX_TOKEN =
  'pk.eyJ1Ijoic2FuZG9uanVyb3dza2kiLCJhIjoiY21iMWZ1cTl6MDd1cTJrb2kwbzBtNDA0MiJ9.4sm5hCpIOLmDKXwwccXbAw';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { city, state } = req.query;
  if (!city || !state) return json({ error: 'Missing city or state' });

  try {
    const { data: cached } = await supabase
      .from('geo_cache')
      .select('*')
      .eq('city', city)
      .eq('state', state)
      .single();

    if (cached) return json({ lat: cached.lat, lon: cached.lon });

    const query = encodeURIComponent(`${city}, ${state}, USA`);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_TOKEN}`;
    const geoRes = await fetch(url);
    const json = await geoRes.json();

    const feature = json.features?.[0];
    if (!feature) throw new Error('No location found');

    const [lon, lat] = feature.center;

    await supabase.from('geo_cache').insert([
      {
        city,
        state,
        lat,
        lon,
      },
    ]);

    json({ lat, lon });
  } catch (err: any) {
    json({ error: 'Geocoding failed', message: err.message });
  }
}
