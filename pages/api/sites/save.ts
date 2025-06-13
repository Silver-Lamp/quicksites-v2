import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, data } = req.body;

  if (!id || !data) {
    return res.status(400).json({ error: 'Missing site ID or data' });
  }

  const { error } = await supabase
    .from('sites')
    .update({
      content: data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('Save error:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true });
}