import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

async function generateDigest(user_id: string) {
  const res = await fetch(\`http://localhost:3000/api/feedback-summary?user_id=\${user_id}\`);
  const summary = await res.json();

  const prompt = \`
You are an encouraging coach AI. Write a short weekly digest from this user's data:

Check-ins:
\${summary.checkin_history.map(c => \`• \${c.slug} at \${c.created_at}\`).join('\n')}

Feedback:
\${summary.received_feedback.map(f => \`• \${f.action} on \${f.block_id.slice(0, 8)}: \${f.message || ''}\`).join('\n')}
\`;

  const chat = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You generate weekly coaching summaries from activity logs.' },
      { role: 'user', content: prompt }
    ]
  });

  return chat.choices[0].message.content;
}

export default async function handler(req, res) {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) return res.status(500).json({ error });

  const summaries: any[] = [];

  for (const user of users) {
    const email = user.email;
    const user_id = user.id;

    const digest = await generateDigest(user_id);

    await supabase.from('digest_emails_sent').insert({
      user_id,
      summary: digest
    });

    // Replace with Resend or actual SMTP call
    console.log('Would email to:', email);
    console.log(digest);

    summaries.push({ email, digest });
  }

  res.status(200).json({ sent: summaries.length });
}
