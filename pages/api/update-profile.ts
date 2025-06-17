import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  const token = _req.headers.authorization?.replace('Bearer ', '');
  const { bio, emoji, goal_tags, visible, handle } = _req.body;

  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  if (!user || !handle) return json({ error: 'Unauthorized' });

  const { error } = await supabase.from('public_profiles').upsert({
    user_id: user.id,
    handle,
    bio,
    emoji,
    goal_tags,
    visible,
    updated_at: new Date().toISOString(),
  });

  if (error) return json({ error });

  json({ success: true });
}
