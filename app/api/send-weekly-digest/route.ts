import { createClient } from '@supabase/supabase-js';
import { lazyClient } from '@/lib/lazyClient';
import { json } from '@/lib/api/json';
import { OpenAI } from 'openai';
import { meterLLMCall } from '@/lib/ai/meter';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!
);

const openai = lazyClient(() => new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
}));

async function generateDigest(user_id: string) {
  const res = await fetch(`http://localhost:3000/api/feedback-summary?user_id=${user_id}`);
  const summary = await res.json();

  const prompt = `
You are an encouraging coach AI. Write a short weekly digest from this user's data:

Check-ins:
${summary.checkin_history.map((c: any) => `• ${c.slug} at ${c.created_at}`).join('\n')}

Feedback:
${summary.received_feedback.map((f: any) => `• ${f.action} on ${f.block_id.slice(0, 8)}: ${f.message || ''}`).join('\n')}
`;

  // Cron helper (no HTTP response here) — meter for cost logging; let any
  // LLMBudgetExceededError propagate to the GET handler.
  return await meterLLMCall(
    { provider: 'openai', model_code: 'gpt-4', modality: 'chat', route: '/api/send-weekly-digest' },
    async () => {
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
      return {
        value: chat.choices[0].message.content,
        usage: {
          input_tokens: chat.usage?.prompt_tokens,
          output_tokens: chat.usage?.completion_tokens,
        },
      };
    },
  );
}

export async function GET() {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) return json({ error: error.message });

  const summaries: any[] = [];

  for (const user of users.users) {
    const email = user.email;
    const user_id = user.id;

    const digest = await generateDigest(user_id);

    await supabase.from('digest_emails_sent').insert({
      user_id,
      summary: digest,
    });

    // Replace with Resend or actual SMTP call
    console.log('Would email to:', email);
    console.log(digest);

    summaries.push({ email, digest });
  }

  return json({ sent: summaries.length });
}
