// scripts/enrich-leads-latlon.ts

// Run dry-run like:
// DRY_RUN=true ts-node scripts/enrich-leads-latlon.ts
// NODE_OPTIONS=--loader=ts-node/esm DRY_RUN=true ts-node scripts/enrich-leads-latlon.ts

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getLatLonForCityState } from '../lib/utils/geocode.js';
import fs from 'fs';
import { getDistanceMiles } from '../lib/utils/distance.js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DRY_RUN = process.env.DRY_RUN === 'true';
const RATE_LIMIT_MS = 1100;
const LOG_FILE = 'rollback-log.json';

type EnrichedResult = {
  id: string;
  lat: number;
  lon: number;
};

async function enrichLeadCoordinates() {
  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, business_name, address_city, address_state, address_lat, address_lon');

  if (error) {
    console.error('Failed to fetch leads:', error);
    return;
  }

  const enriched: EnrichedResult[] = [];
  const failedCities: { id: string; city: string; state: string | null }[] = [];
  let totalProcessed = 0;

  for (const lead of leads || []) {
    const city = lead.address_city;
    const state = lead.address_state;
    if (!city || lead.address_lat !== null || lead.address_lon !== null) continue;

    let coords: { lat: number; lon: number } | null = null;
    try {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          coords = await getLatLonForCityState(city, state);
          if (coords) break;
        } catch {
          console.warn(`🌐 Attempt ${attempt} failed for ${city}, ${state}`);
        }
        await new Promise((res) => setTimeout(res, RATE_LIMIT_MS * attempt));
      }
    } catch (e) {
      console.warn(`🌐 Failed to geocode city: ${city}, ${state}`, e);
    }

    if (!coords) {
      failedCities.push({ id: lead.id, city, state });
      continue;
    }

    const dist = getDistanceMiles(coords.lat, coords.lon, coords.lat, coords.lon);
    console.log(`${lead.id} → ${coords.lat}, ${coords.lon} • ${dist.toFixed(1)} mi`);

    if (!DRY_RUN) {
      const { error: updateError } = await supabase
        .from('leads')
        .update({ address_lat: coords.lat, address_lon: coords.lon })
        .eq('id', lead.id);

      if (!updateError) {
        enriched.push({ id: lead.id, lat: coords.lat, lon: coords.lon });
        console.log(`✅ Updated ${lead.business_name}`);
      } else {
        console.warn(`❌ Failed to update ${lead.id}`, updateError);
      }

      await new Promise((res) => setTimeout(res, RATE_LIMIT_MS));
      totalProcessed++;

      if (totalProcessed % 10 === 0) {
        console.log('⏸ Pausing briefly after 10 leads...');
        await new Promise((res) => setTimeout(res, 5000));
      }
    }
  }

  if (!DRY_RUN) {
    fs.writeFileSync(LOG_FILE, JSON.stringify(enriched, null, 2));
    console.log(`📦 Saved enriched leads to ${LOG_FILE}`);
  }

  if (!DRY_RUN && failedCities.length > 0) {
    fs.writeFileSync('failed-cities.json', JSON.stringify(failedCities, null, 2));
    console.log(`⚠️  Saved ${failedCities.length} failed lookups to failed-cities.json`);
  }

  console.log(`🎉 Done. Processed ${totalProcessed} leads.`);
}

enrichLeadCoordinates();
