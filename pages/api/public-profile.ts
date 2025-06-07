import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  const { handle } = req.query;
  if (!handle) return res.status(400).json({ error: 'Missing handle' });

  const { data, error } = await supabase
    .from('public_profiles')
    .select('*')
    .eq('handle', handle)
    .single();

  if (error) return res.status(404).json({ error: 'Not found' });

  res.status(200).json(data);
}
