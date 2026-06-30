// app/api/ask-assistant/route.ts (Next.js 13+ app router)
import { OpenAI } from 'openai';
import { lazyClient } from '@/lib/lazyClient';
import { NextRequest, NextResponse } from 'next/server';
import { meterLLMCall, LLMBudgetExceededError } from '@/lib/ai/meter';

const openai = lazyClient(() => new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}));

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  let reply: string | null;
  try {
    reply = await meterLLMCall(
      { provider: 'openai', model_code: 'gpt-4o', modality: 'chat', route: '/api/ask-assistant' },
      async () => {
        const chat = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content:
                'You are the QuickSites onboarding assistant. You help local business owners understand and launch their websites quickly using QuickSites.ai. Keep responses brief, friendly, and clear.',
            },
            ...messages,
          ],
          temperature: 0.6,
        });
        return {
          value: chat.choices[0]?.message?.content ?? null,
          usage: {
            input_tokens: chat.usage?.prompt_tokens,
            output_tokens: chat.usage?.completion_tokens,
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

  return NextResponse.json({ reply });
}
