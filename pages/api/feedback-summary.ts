import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

  const [feedback, checkins] = await Promise.all([
    supabase
      .from('block_feedback')
      .select('block_id, action, created_at, message')
      .in('block_id',
        supabase.from('blocks').select('id').eq('owner_id', user_id)
      )
      .order('created_at', { ascending: false })
      .limit(100),

    supabase
      .from('tracking_checkins')
      .select('slug, created_at')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(100)
  ]);

  if (feedback.error) return res.status(500).json({ error: feedback.error });
  if (checkins.error) return res.status(500).json({ error: checkins.error });

  const summary = {
    received_feedback: feedback.data,
    checkin_history: checkins.data
  };

  res.status(200).json(summary);
}
