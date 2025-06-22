// app/api/weekly-digest-live/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');

  if (!user_id) {
    return Response.json({ error: 'Missing user_id' }, { status: 400 });
  }

  const feedbackRes = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/feedback-summary?user_id=${user_id}`
  );
  const summary = await feedbackRes.json();

  const prompt = `
You are an encouraging coach AI. Write a 2-3 paragraph weekly summary of this user's behavior.
Highlight check-in trends, mention positive feedback received, and encourage further progress.

Check-ins:
${summary.checkin_history.map((c: any) => `• ${c.slug} at ${c.created_at}`).join('\n')}

Feedback:
${summary.received_feedback.map((f: any) => `• ${f.action} on ${f.block_id.slice(0, 8)}: ${f.message || ''}`).join('\n')}
`;

  const chat = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You generate weekly coaching summaries from activity logs.' },
      { role: 'user', content: prompt },
    ],
  });

  const digest = chat.choices[0].message.content;
  return Response.json({ digest });
}
