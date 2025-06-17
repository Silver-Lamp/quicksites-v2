import type { NextApiRequest, NextApiResponse } from 'next';
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
  if (req.method !== 'POST') return res.status(405).end();

  const { template_name } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];

  const { error } = await supabase.from('snapshot_views').insert([
    {
      template_name,
      ip_address: String(ip),
      user_agent: userAgent,
    },
  ]);

  if (error) return json({ error: error.message });
  json({ success: true });
}
