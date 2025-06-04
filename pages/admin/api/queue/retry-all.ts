import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(_: NextApiRequest, res: NextApiResponse) {
  const { error } = await supabase
    .from('regeneration_queue')
    .update({ retry_enabled: true })
    .eq('status', 'error');

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ message: 'All failed jobs marked for retry' });
}
