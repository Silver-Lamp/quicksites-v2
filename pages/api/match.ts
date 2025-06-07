import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  const { tags } = req.query;
  if (!tags) return res.status(400).json({ error: 'Missing tags' });

  const tagArray = tags.split(',').map(t => t.trim());

  const { data, error } = await supabase
    .from('public_profiles')
    .select('*')
    .contains('goal_tags', tagArray)
    .eq('visible', true)
    .limit(50);

  if (error) return res.status(500).json({ error });

  res.status(200).json(data);
}
