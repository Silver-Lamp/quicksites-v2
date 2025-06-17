import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'DELETE') return res.status(405).end();

  const { id } = req.query;
  const { error } = await supabase
    .from('branding_profiles')
    .delete()
    .eq('id', id);
  if (error) return json({ error });
  json({ success: true });
}
