// POST /api/templates/create
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
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' });
  }

  try {
    const { template_name, industry, layout, color_scheme, data } = req.body;

    const { error } = await supabase
      .from('templates')
      .insert([{ template_name, industry, layout, color_scheme, data }]);

    if (error) return json({ error: error.message });

    json({ success: true });
  } catch (err: any) {
    json({ error: err.message });
  }
}
