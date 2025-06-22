export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');
  if (!user_id) return json({ error: 'Missing user_id' }, { status: 400 });

  // Fetch blocks owned by the user
  const { data: blockIdsRaw, error: blocksError } = await supabase
    .from('blocks')
    .select('id')
    .eq('owner_id', user_id);

  if (blocksError) return json({ error: blocksError.message }, { status: 500 });

  const blockIds = (blockIdsRaw || []).map((b) => b.id);

  // Fetch feedback and check-ins in parallel
  const [feedbackRes, checkinRes] = await Promise.all([
    supabase
      .from('block_feedback')
      .select('block_id, action, created_at, message')
      .in('block_id', blockIds)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('tracking_checkins')
      .select('slug, created_at')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  if (feedbackRes.error) return json({ error: feedbackRes.error.message }, { status: 500 });
  if (checkinRes.error) return json({ error: checkinRes.error.message }, { status: 500 });

  const summary = {
    received_feedback: feedbackRes.data,
    checkin_history: checkinRes.data,
  };

  return json(summary);
}
