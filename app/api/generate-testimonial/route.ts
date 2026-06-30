import { NextResponse } from 'next/server';
import { lazyClient } from '@/lib/lazyClient';
import { OpenAI } from 'openai';
import { meterLLMCall, LLMBudgetExceededError } from '@/lib/ai/meter';

const openai = lazyClient(() => new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // NOT the public one!
}));

export async function POST(req: Request) {
  const { prompt, industry } = await req.json();

  let quote: string;
  try {
    quote = await meterLLMCall(
      { provider: 'openai', model_code: 'gpt-4o-mini', modality: 'chat', route: '/api/generate-testimonial' },
      async () => {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
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
