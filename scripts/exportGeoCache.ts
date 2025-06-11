// scripts/exportGeoCache.ts
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

async function exportGeoCache() {
  const { data, error } = await supabase
    .from('geo_cache')
    .select('city, state, lat, lon');

  if (error) throw error;

  const geoMap: Record<string, { lat: number; lon: number }> = {};
  for (const row of data || []) {
    if (!row.city || !row.state) continue;
    const key = `${row.city.trim()},${row.state.trim()}`.toLowerCase();
    geoMap[key] = { lat: Number(row.lat), lon: Number(row.lon) };
  }

  const filePath = path.resolve(__dirname, '../public/staticGeo.json');
  fs.writeFileSync(filePath, JSON.stringify(geoMap, null, 2));
  console.log(`✅ Exported ${Object.keys(geoMap).length} locations to staticGeo.json`);
}

exportGeoCache().catch(console.error);
