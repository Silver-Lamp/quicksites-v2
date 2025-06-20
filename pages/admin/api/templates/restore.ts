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

  const { template_name } = req.body;

  if (!template_name) {
    return json({ error: 'template_name is required' });
  }

  const restored_at = new Date().toISOString();
  const { error } = await supabase
    .from('templates')
    .update({ deleted_at: null, restored_at })
    .eq('template_name', template_name);

  await supabase.from('template_logs').insert({
    action: 'restore',
    template_name,
    actor: req.headers['x-forwarded-for'] || 'unknown',
    timestamp: restored_at,
  });

  if (error) {
    return json({ error: error.message });
  }

  return json({ success: true });
}
