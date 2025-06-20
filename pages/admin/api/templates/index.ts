// GET /api/templates
import { NextApiRequest, NextApiResponse } from 'next';
import { json } from '@/lib/api/json';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('>>> RUNNING (/pages/admin/api/template-api/index.ts) in:', __filename);

  const { data, error } = await supabase
    .from('templates')
    .select('template_name, industry, layout, color_scheme');

  if (error) return json({ error: error.message });
  json(data);
}
