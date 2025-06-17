import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import type { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' });
  }

  const { id, data } = req.body;

  if (!id || !data) {
    return json({ error: 'Missing site ID or data' });
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
    return json({ error: error.message });
  }

  return json({ success: true });
}
