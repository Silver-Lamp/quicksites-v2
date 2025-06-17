// GET /api/templates/[templateName]
import { NextApiRequest, NextApiResponse } from 'next';
import { json } from '@/lib/api/json';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { templateName } = req.query;

  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('template_name', templateName)
    .single();

  if (error) return json({ error: error.message });
  json(data);
}
