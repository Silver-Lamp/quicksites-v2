import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // NOT the public one!
});

export async function POST(req: Request) {
  const { prompt, industry } = await req.json();

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: `Generate a short, 1-2 sentence customer testimonial for the ${industry} industry.` },
      { role: 'user', content: prompt },
    ],
  });

  const quote = completion.choices[0]?.message?.content?.trim() || '';
  return NextResponse.json({ quote });
}
