import type { NextApiRequest, NextApiResponse } from 'next';
import { json } from '@/lib/api/json';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return json({ error: 'Method not allowed' });
  }

  const { template_name } = req.body;

  if (!template_name) {
    return json({ error: 'template_name is required' });
  }

  const { error } = await supabase.from('templates').delete().eq('template_name', template_name);

  if (error) {
    return json({ error: error.message });
  }

  return json({ success: true });
}
