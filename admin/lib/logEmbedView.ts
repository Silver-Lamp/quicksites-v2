// lib/logEmbedView.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function logEmbedView(schema_id: string) {
  try {
    const referrer = document.referrer || null;

    const ipRes = await fetch('https://api64.ipify.org?format=json');
    const { ip } = await ipRes.json();

    const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
    const geo = await geoRes.json();

    const location = geo.city && geo.country_name ? `${geo.city}, ${geo.country_name}` : geo.country_name || 'Unknown';

    await supabase.from('embed_views').insert({
      schema_id,
      referrer,
      ip,
      location,
      region: geo.region,
      country_code: geo.country_code,
    });
  } catch (err) {
    console.warn('View logging failed:', err);
  }
}
