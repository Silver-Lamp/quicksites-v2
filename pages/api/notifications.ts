import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  const { handle } = req.query;
  if (!handle) return res.status(400).json({ error: 'Missing handle' });

  const { data, error } = await supabase
    .from('support_requests')
    .select('*')
    .eq('receiver_handle', handle)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error });

  res.status(200).json(data);
}
