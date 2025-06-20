import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slug } = req.query;
  if (!slug) return json({ error: 'Missing slug' });

  const { data: campaign, error } = await supabase
    .from('support_campaigns')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !campaign) return json({ error: 'Campaign not found' });

  const { data: countData } = await supabase
    .from('block_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('block_id', campaign.block_id)
    .eq('action', campaign.target_action);

  json({ ...campaign, count: countData?.length || 0 });
}
