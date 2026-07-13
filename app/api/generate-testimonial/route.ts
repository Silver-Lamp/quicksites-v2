import { NextResponse } from 'next/server';
import { lazyClient } from '@/lib/lazyClient';
import { getOpenAI, resolveModel } from '@/lib/ai/openaiClient';
import { meterLLMCall, LLMBudgetExceededError } from '@/lib/ai/meter';
import { getServerSupabase } from '@/lib/supabase/server';
import { enforceGuestAiLimit, guestLimitBody } from '@/lib/ai/guestGuard';

const openai = lazyClient(() => getOpenAI('chat'));

export async function POST(req: Request) {
  const { prompt, industry } = await req.json();

  // Cap anonymous (guest) users; real users pass.
  const { data: auth } = await (await getServerSupabase()).auth.getUser();
  const guard = await enforceGuestAiLimit(auth?.user, 'testimonial');
  if (!guard.ok) return NextResponse.json(guestLimitBody(guard.limit), { status: 429 });

  let quote: string;
  try {
    quote = await meterLLMCall(
      { provider: 'openai', model_code: 'gpt-4o-mini', modality: 'chat', route: '/api/generate-testimonial', user_id: auth?.user?.id ?? null },
      async () => {
        const completion = await openai.chat.completions.create({
          model: resolveModel('gpt-4o-mini', 'chat'),
          messages: [
            { role: 'system', content: `Generate a short, 1-2 sentence customer testimonial for the ${industry} industry.` },
            { role: 'user', content: prompt },
          ],
        });
        return {
          value: completion.choices[0]?.message?.content?.trim() || '',
          usage: {
            input_tokens: completion.usage?.prompt_tokens,
            output_tokens: completion.usage?.completion_tokens,
          },
        };
      },
    );
  } catch (e) {
    if (e instanceof LLMBudgetExceededError) {
      return NextResponse.json({ error: 'AI budget reached, please try again later.' }, { status: 429 });
    }
    throw e;
  }

  return NextResponse.json({ quote });
}
