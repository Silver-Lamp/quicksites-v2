import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  const { handle } = req.query;
  if (!handle) return res.status(400).json({ error: 'Missing handle' });

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('user_metadata->>handle', handle)
    .single();

  if (!user) return res.status(404).json({ error: 'User not found' });

  const { data, error } = await supabase
    .from('blocks')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error });

  res.status(200).json(data);
}
