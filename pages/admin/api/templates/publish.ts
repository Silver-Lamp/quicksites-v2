import type { NextApiRequest, NextApiResponse } from 'next';
import { json } from '@/lib/api/json';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' });
  }

  const { template_name, domain } = req.body;
  if (!template_name || !domain) {
    return json({ error: 'Missing template_name or domain' });
  }

  const { error } = await supabase
    .from('templates')
    .update({ domain })
    .eq('template_name', template_name);

  if (error) {
    return json({ error: error.message });
  }

  return json({ success: true });
}
