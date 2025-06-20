import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Optional OpenAI call — can be replaced with real prompt later
function generateDigestMock(summary: any) {
  const feedbackCount = summary.received_feedback.length;
  const checkinCount = summary.checkin_history.length;
  const topHabit = summary.checkin_history[0]?.slug || 'your habit';

  return `This week, you checked in ${checkinCount} times, with a focus on "${topHabit}". You've received ${feedbackCount} supportive gestures. Keep up the great momentum — you're building a powerful rhythm. 🌱`;
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const { user_id } = _req.query;
  if (!user_id) return json({ error: 'Missing user_id' });

  const response = await fetch(`/api/feedback-summary?user_id=${user_id}`);
  const summary = await response.json();

  const digest = generateDigestMock(summary);
  json({ digest });
}
