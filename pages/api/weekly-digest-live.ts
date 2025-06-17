import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { progress } from 'framer-motion';
import { a } from 'framer-motion/dist/types.d-B_QPEvFK';
import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import digest from '../admin/api/digest';
import summary from '../creator/me/summary';
import feedback from './logs/feedback';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  const { user_id } = _req.query;
  if (!user_id) return json({ error: 'Missing user_id' });

  const feedbackRes = await fetch(
    `http://localhost:3000/api/feedback-summary?user_id=${user_id}`
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
      {
        role: 'system',
        content: 'You generate weekly coaching summaries from activity logs.',
      },
      { role: 'user', content: prompt },
    ],
  });

  const digest = chat.choices[0].message.content;
  json({ digest });
}
