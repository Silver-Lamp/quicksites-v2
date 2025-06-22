export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(_req: NextRequest) {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const [failed, feedback, checkins] = await Promise.all([
    supabase
      .from('notification_logs')
      .select('id', { count: 'exact', head: true })
      .eq('event', 'badge_notify_failed'),
    supabase
      .from('block_feedback')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', oneDayAgo.toISOString()),
    supabase
      .from('published_site_views')
      .select('id', { count: 'exact', head: true })
      .gt('viewed_at', oneDayAgo.toISOString()),
  ]);

  if (failed.error || feedback.error || checkins.error) {
    return json({ error: 'Failed to fetch badge metrics.' });
  }

  return json({
    failed: failed.count,
    new_feedback: feedback.count,
    checkins: checkins.count,
  });
}
