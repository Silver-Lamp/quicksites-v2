// pages/api/sites.ts

import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import type { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // or anon key if secure enough
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { data, error } = await supabase.from('public_sites').select('*');

  if (error) {
    return json({ error: error.message });
  }

  json(data);
}
