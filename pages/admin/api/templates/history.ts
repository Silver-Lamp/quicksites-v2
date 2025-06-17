// /admin/api/templates/history?name=towing-basic
import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { name } = req.query;

  if (!name || typeof name !== 'string') {
    return json({ error: 'Missing or invalid template name.' });
  }

  const { data, error } = await supabase
    .from('template_versions')
    .select('*')
    .eq('template_name', name)
    .order('saved_at', { ascending: false });

  if (error) {
    console.error('[Supabase] Error fetching template_versions:', error);
    return json({ error: error.message });
  }

  json(data);
}
