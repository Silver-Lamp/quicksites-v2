import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const { handle } = _req.query;
  if (!handle) return json({ error: 'Missing handle' });

  const { data: blocks } = await supabase.from('blocks').select('id').eq('owner_handle', handle);

  const blockIds = blocks?.map((b) => b.id) || [];

  const { data: feedback, error } = await supabase
    .from('block_feedback')
    .select('user_id, action, created_at')
    .in('block_id', blockIds);

  if (error) return json({ error });

  const supporters = feedback.reduce((acc: any, item: any) => {
    if (!acc[item.user_id]) acc[item.user_id] = { cheer: 0, echo: 0, reflect: 0 };
    acc[item.user_id][item.action]++;
    return acc;
  }, {});

  json(
    Object.entries(supporters).map(([uid, counts]: any) => ({
      user_id: uid,
      ...counts,
    }))
  );
}
