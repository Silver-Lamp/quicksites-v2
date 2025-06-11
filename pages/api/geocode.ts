// pages/api/geocode.ts
import { supabase } from '@/lib/supabase';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { city, state } = req.query;

  if (!city || !state || typeof city !== 'string' || typeof state !== 'string') {
    return res.status(400).json({ error: 'Missing city or state' });
  }

  const cleanCity = city.trim();
  const cleanState = state.trim();

  // 1. Try to fetch from Supabase cache
  const { data: cached, error: fetchError } = await supabase
    .from('geo_cache')
    .select('lat, lon')
    .eq('city', cleanCity)
    .eq('state', cleanState)
    .maybeSingle();

  if (cached) {
    console.log(`🌍 Cache hit for ${cleanCity}, ${cleanState}`);
    return res.status(200).json({ lat: Number(cached.lat), lon: Number(cached.lon) });
  }

  // 2. Fallback to Nominatim
  const query = `${cleanCity}, ${cleanState}, USA`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;

  try {
    const geoRes = await fetch(url, {
      headers: {
        'User-Agent': 'QuickSites/1.0 (admin@quicksites.ai)', // customize contact per Nominatim policy
      },
    });

    const results = await geoRes.json();

    if (!Array.isArray(results) || results.length === 0) {
      return res.status(404).json({ lat: 0, lon: 0, error: 'Not found' });
    }

    const { lat, lon } = results[0];
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);

    // 3. Insert into Supabase cache (will auto-generate UUID)
    await supabase.from('geo_cache').insert([
      {
        city: cleanCity,
        state: cleanState,
        lat: parsedLat,
        lon: parsedLon,
      },
    ]);

    console.log(`🌍 Cached ${cleanCity}, ${cleanState} -> ${parsedLat}, ${parsedLon}`);
    return res.status(200).json({ lat: parsedLat, lon: parsedLon });
  } catch (err) {
    console.error('🌍 Geocode error:', err);
    return res.status(500).json({ lat: 0, lon: 0, error: 'Internal error' });
  }
}
