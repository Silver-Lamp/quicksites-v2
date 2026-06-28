export const runtime = 'nodejs';

import { supabase } from '@/admin/lib/supabaseClient';
import { json } from '@/lib/api/json';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get('city');
  const state = searchParams.get('state');

  if (!city || !state) {
    return json({ error: 'Missing city or state' }, { status: 400 });
  }

  const cleanCity = city.trim();
  const cleanState = state.trim();

  // 1. Try cache
  const { data: cachedData, error: fetchError } = await supabase
    .from('geo_cache')
    .select('lat, lon')
    .eq('city', cleanCity)
    .eq('state', cleanState)
    .maybeSingle();

  // @ts-ignore - Supabase type inference issue with geo_cache table
  const cached = cachedData as { lat: number | string; lon: number | string } | null;

  if (cached) {
    console.log(`🌍 Cache hit for ${cleanCity}, ${cleanState}`);
    return json({ lat: Number(cached.lat), lon: Number(cached.lon) });
  }

  // 2. Fallback to OpenStreetMap's Nominatim
  const query = `${cleanCity}, ${cleanState}, USA`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;

  try {
    const geoRes = await fetch(url, {
      headers: {
        'User-Agent': 'QuickSites/1.0 (support@quicksites.ai)',
      },
    });

    const results = await geoRes.json();

    if (!Array.isArray(results) || results.length === 0) {
      return json({ lat: 0, lon: 0, error: 'Not found' }, { status: 404 });
    }

    const { lat, lon } = results[0];
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);

    // 3. Cache result (geo_cache cols not in typed schema — cast to any; robust vs @ts-ignore)
    await (supabase as any).from('geo_cache').insert([
      {
        city: cleanCity,
        state: cleanState,
        lat: parsedLat,
        lon: parsedLon,
      },
    ]);

    console.log(`🌍 Cached ${cleanCity}, ${cleanState} → ${parsedLat}, ${parsedLon}`);
    return json({ lat: parsedLat, lon: parsedLon });
  } catch (err) {
    console.error('🌍 Geocode error:', err);
    return json({ lat: 0, lon: 0, error: 'Internal error' }, { status: 500 });
  }
}
