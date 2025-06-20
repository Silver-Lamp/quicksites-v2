import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ⚠️ Only safe to use server-side
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { block_id, action, handle } = req.body;

  const { error } = await supabase.from('click_events').insert({
    block_id,
    action,
    handle,
    metadata: {
      ua: req.headers['user-agent'],
      referrer: req.headers.referer || '',
    },
  });

  if (error) return json({ error });
  json({ success: true });
}
