import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const { block_id, message } = req.body;

  const {
    data: { user }
  } = await supabase.auth.getUser(token);

  if (!user || !block_id) return res.status(401).json({ error: 'Unauthorized' });

  const { error } = await supabase
    .from('block_feedback')
    .insert({
      block_id,
      user_id: user.id,
      action: 'cheer',
      message: message || null
    });

  if (error) return res.status(500).json({ error });

  res.status(200).json({ success: true });
}
