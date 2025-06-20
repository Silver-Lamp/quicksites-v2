import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data, error } = await supabase.from('token_logs').select('*');

if (error) {
  console.error('Failed to load token logs');
  process.exit(1);
}

const byToken: Record<string, Set<string>> = {};
for (const log of data) {
  if (!log.token_hash || !log.ip_location) continue;
  if (!byToken[log.token_hash]) byToken[log.token_hash] = new Set();
  byToken[log.token_hash].add(log.ip_location);
}

for (const [hash, locations] of Object.entries(byToken)) {
  if (locations.size > 1) {
    console.log(`⚠️ Geo anomaly: Token ${hash} used from ${Array.from(locations).join(', ')}`);
  }
}
