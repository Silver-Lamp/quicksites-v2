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
    const key = `${row.city.trim().toLowerCase()},${row.state.trim().toLowerCase()}`;
    geoMap[key] = {
      lat: Number(row.lat),
      lon: Number(row.lon),
    };
  }

  const outputPath = path.resolve(__dirname, '../public/staticGeo.json');
  fs.writeFileSync(outputPath, JSON.stringify(geoMap, null, 2));

  console.log(`✅ Exported ${Object.keys(geoMap).length} entries to staticGeo.json`);
}

exportGeoCache().catch((err) => {
  console.error('❌ Failed to export geo cache:', err);
});
