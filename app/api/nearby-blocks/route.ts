export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return json({ error: 'Missing lat/lon' }, { status: 400 });
  }

  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  const radius = 0.01; // Approx. 1km neighborhood

  const { data, error } = await supabase
    .from('blocks')
    .select('*')
    .gte('lat', latNum - radius)
    .lte('lat', latNum + radius)
    .gte('lon', lonNum - radius)
    .lte('lon', lonNum + radius)
    .order('created_at', { ascending: false });

  if (error) return json({ error: error.message }, { status: 500 });

  return json(data);
}
