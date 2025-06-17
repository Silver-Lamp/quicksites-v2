// pages/api/template-api/index.ts
import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[API] /api/template-api hit');

  const { data, error } = await supabase.rpc('get_latest_template_versions');

  if (error) {
    console.error('[API ERROR]', error.message);
    return json({ error: error.message });
  }

  const enriched = (data || []).map((item: any) => ({
    ...item,
    description: item.commit_message || 'No description provided',
  }));

  console.log(`[API] returning ${enriched.length} templates`);
  json(enriched);
}
