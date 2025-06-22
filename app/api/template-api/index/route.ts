export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(_req: Request) {
  console.log('[API] /api/template-api hit');

  const { data, error } = await supabase.rpc('get_latest_template_versions');

  if (error) {
    console.error('[API ERROR]', error.message);
    return json({ error: error.message }, { status: 500 });
  }

  const enriched = (data || []).map((item: any) => ({
    ...item,
    description: item.commit_message || 'No description provided',
  }));

  console.log(`[API] returning ${enriched.length} templates`);
  return json(enriched);
}
