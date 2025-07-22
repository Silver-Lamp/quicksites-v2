// app/api/ask-assistant/route.ts (Next.js 13+ app router)
import { OpenAI } from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

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

  return NextResponse.json({ reply: chat.choices[0].message.content });
}
