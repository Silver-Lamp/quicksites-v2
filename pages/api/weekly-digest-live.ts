import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

export default async function handler(req, res) {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

  const feedbackRes = await fetch(\`http://localhost:3000/api/feedback-summary?user_id=\${user_id}\`);
  const summary = await feedbackRes.json();

  const prompt = `
You are an encouraging coach AI. Write a 2-3 paragraph weekly summary of this user's behavior.
Highlight check-in trends, mention positive feedback received, and encourage further progress.

Check-ins:
${summary.checkin_history.map(c => \`• \${c.slug} at \${c.created_at}\`).join('\n')}

Feedback:
${summary.received_feedback.map(f => \`• \${f.action} on \${f.block_id.slice(0, 8)}: \${f.message || ''}\`).join('\n')}
`;

  const chat = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You generate weekly coaching summaries from activity logs.' },
      { role: 'user', content: prompt }
    ]
  });

  const digest = chat.choices[0].message.content;
  res.status(200).json({ digest });
}
