export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name');

  if (!name) {
    return json({ error: 'Missing or invalid template name.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('template_versions')
    .select('*')
    .eq('template_name', name)
    .order('saved_at', { ascending: false });

  if (error) {
    console.error('[Supabase] Error fetching template_versions:', error);
    return json({ error: error.message }, { status: 500 });
  }

  return json(data);
}
