export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Mocked digest message generator
function generateDigestMock(summary: any) {
  const feedbackCount = summary.received_feedback.length;
  const checkinCount = summary.checkin_history.length;
  const topHabit = summary.checkin_history[0]?.slug || 'your habit';

  return `This week, you checked in ${checkinCount} times, with a focus on "${topHabit}". You've received ${feedbackCount} supportive gestures. Keep up the great momentum — you're building a powerful rhythm. 🌱`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');

  if (!user_id) {
    return json({ error: 'Missing user_id' }, { status: 400 });
  }

  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://quicksites.ai';
    const response = await fetch(`${base}/api/feedback-summary?user_id=${user_id}`);
    const summary = await response.json();

    const digest = generateDigestMock(summary);
    return json({ digest });
  } catch (err: any) {
    console.error('Digest generation failed:', err);
    return json({ error: 'Failed to generate digest' }, { status: 500 });
  }
}
