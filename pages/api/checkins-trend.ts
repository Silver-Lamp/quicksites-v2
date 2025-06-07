import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: 'Missing slug' });

  const { data, error } = await supabase.rpc('daily_checkins_by_slug', { slug });

  if (error) return res.status(500).json({ error });

  res.status(200).json(data);
}
